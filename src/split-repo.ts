import core from "@actions/core"
import github from "@actions/github"
import { glob } from "glob"
import { throttling } from "@octokit/plugin-throttling"
import path from "path"
import fs from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import { Octokit } from "@octokit/rest"
import { PythonShell } from "python-shell"

export interface Options {
  username?: string
  token: string
  match: string
  filter?: string
  packageJson?: boolean
  metaJson?: string
  topics?: boolean
  description?: boolean
  org?: string
  help?: boolean
  source?: string
  root?: string
  force?: boolean
  /**
   * Path to the git-filter-repo executable
   *
   * @default "/git-filter-repo"
   */
  gitFilterRepo?: string
  dev?: boolean
}

const error =
  typeof core?.setFailed === "function" ? core.setFailed : console.error

const log = typeof core?.info === "function" ? core.info : console.log
const warn = typeof core?.warning === "function" ? core.warning : console.warn

export async function splitRepo(options: Options) {
  const {
    username,
    force,
    token,
    match,
    filter,
    root,
    packageJson,
    metaJson,
    source,
    topics = true,
    description = true,
    org,
    help,
    gitFilterRepo = "/git-filter-repo",
    dev,
  } = options

  if (help) {
    log(`Usage: repo-split.ts <github repo url> <github username>
Options:
--username, string, github username
--token, string, github token
--match, string, glob expression for matching the wanted subrepos name. Can be used multiple times
--filter, string, regex to filter the subrepo name. Only things that match the match and do not match the filter regex will be used
--package-json, boolean, use the name field in the package.json file as the subrepo name
--meta-json, string, file path to a json file (relative to the subrepo) with the name, description, and topics of the subrepo
--topics, boolean, set the topics of the repository using the topics field in the package/meta.json file
--description, boolean, set the description of the repository using the description field in the package/meta.json file
--org, string, use the org name instead of the username
--help, boolean, print help`)
    process.exit(0)
  }

  if (!match) {
    error("Please supply a match glob!")
    return
  }

  // let repo: string;
  // let username: string;
  // let org: string | undefined;
  // let createRepoUrl: string;
  // let curlUrl: string;

  if (!username && !org) {
    error("Please supply a username or org")
    return
  }

  if (!token) {
    error("No token was set, please supply a token")
    return
  }

  const orgOrUser = org || username

  if (!orgOrUser) {
    core.setFailed("Please supply a username or org")
    return
  }

  log(orgOrUser)

  const ThrottledOctokit = Octokit.plugin(throttling)
  const octokit = new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter: number, options: any) => {
        warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        )
        // Retry twice after hitting a rate limit error, then give up
        if (options.request.retryCount <= 2) {
          log(`Retrying after ${retryAfter} seconds!`)
          return true
        }
      },
      onSecondaryRateLimit: (retryAfter: number, options: any) => {
        warn(
          `Secondary rate limit triggered for request ${options.method} ${options.url}`
        )
        if (options.request.retryCount <= 2) {
          log(`Retrying after ${retryAfter} seconds!`)
          return true
        }
      },
    },
  })

  log({ octokit })

  if (metaJson) {
    log("Using meta.json file")
  } else if (packageJson) {
    log("Using package.json file")
  }

  const meta = packageJson ? "package.json" : metaJson

  const existingRepos = org
    ? await octokit.repos.listForOrg({ org: orgOrUser })
    : await octokit.repos.listForAuthenticatedUser()

  log(existingRepos)
  const existingRepoNames = existingRepos?.data?.map((repo) => repo.name) ?? []
  log(existingRepoNames)

  const globs = match.split(" ")

  const base = root ? path.join(process.cwd(), root) : process.cwd()
  const subrepos = meta
    ? await glob(
        globs.map((glb) => `${glb}/${meta}`),
        { cwd: base }
      )
    : await glob(globs, { cwd: base })

  log(subrepos)

  const fitleredSubrepos = filter
    ? subrepos.filter((subrepo) => {
        if (subrepo.match(filter)) {
          core.debug(`Filtered out ${subrepo}`)
          return false
        }
        return true
      })
    : subrepos

  log(fitleredSubrepos)

  // run git-filter-repo
  const execAsync = promisify(exec)

  log(base)

  try {
    const { stdout, stderr } = await execAsync(`
  cd ${base}
  ${
    dev
      ? ""
      : `
git config user.email "tefkah-actions-monorepo-split@example.org"
git config user.name "${orgOrUser}"

git config --global init.defaultBranch main
git config --global --add safe.directory ${base}/${source ?? ".git"}
git config --global --add safe.directory ${base}

git for-each-ref --format '%(refname:short)' refs/heads | grep -v "main" | xargs git branch -D
`
  }`)

    log(stdout)
    log(stderr)
  } catch (e) {
    log(e)
  }
  log(fitleredSubrepos)

  log(base)
  const loop = await Promise.all(
    fitleredSubrepos.map(async (subrepo) => {
      const subrepoDir = path.dirname(subrepo)
      // remove eventual `meta` file from the path
      const subrepoName = path.basename(subrepoDir.replace(meta ?? "", ""))

      // check if this repo is touched by the latest commit
      const { stdout: touched } = await execAsync(`
    cd ${base}
    git log -1 --name-only ${path.join(base, subrepoDir)}
  `)
      log(touched)

      if (!touched && !dev && !force) {
        log(
          `Skipping ${subrepoName} as it was not touched by the latest commit`
        )
        return
      }

      const metadata = meta
        ? JSON.parse(await fs.readFile(path.join(base, subrepo), "utf8"))
        : {}

      log(metadata)
      const {
        name: metaName,
        description: metaDescription,
        keywords: metaTopics,
      } = metadata

      const repoName = metaName || subrepoName

      log("base", base)
      log(subrepo, path.join(base, subrepoDir))
      try {
        const { stdout: out, stderr: err } = await execAsync(`
    cd ${path.join(base, subrepoDir)}

    git init

    ${
      dev
        ? ""
        : `git config --global --add safe.directory ${path.join(
            base,
            subrepoDir
          )}`
    }
`)

        const gfrCommand = `${
          path.join(base, gitFilterRepo) ?? "/git-filter-repo"
        }`
        log("Git-filter-repo command: ", gfrCommand)
        const fitlerRepo = await PythonShell.run(gfrCommand, {
          args: [
            "--subdirectory-filter",
            subrepoDir,
            "--force",
            "--source",
            path.join(base, source ?? ".git"),
            "--target",
            path.join(base, subrepoDir, ".git"),
          ],
        })

        log(fitlerRepo)
        log(out)
        log(err)
        log("Finishd git-filter-repo")

        const { stdout, stderr } = await execAsync(
          `
      git add .  ${path.join(base, subrepoDir)}
      `,
          {
            cwd: path.join(base, subrepoDir),
          }
        )

        log(stdout)
        log(stderr)
      } catch (e) {
        log(e)
      }

      if (!existingRepoNames.includes(repoName)) {
        try {
          await octokit.rest.repos.createForAuthenticatedUser({
            name: repoName,
          })
        } catch (e) {
          log(e)
        }
      }

      if (topics) {
        const replaceTopics = await octokit.rest.repos.replaceAllTopics({
          owner: orgOrUser,
          repo: repoName,
          names: metaTopics,
        })
        log(replaceTopics)
      }

      if (description) {
        const replacedDescription = await octokit.rest.repos.update({
          owner: orgOrUser,
          repo: repoName,
          description: metaDescription,
        })
        log(replacedDescription)
      }

      try {
        const { stderr, stdout } = await execAsync(`
    git remote add origin https://$username:${token}@github.com/$orgOrUser/$repoName.git
    git push -u origin main --force

    cd ${base}
    `)

        log(stdout)
        return stdout
      } catch (e) {
        log(e)
      }

      return
    })
  )
}
/**
# loop through the subrepos
for subrepo in $subrepos; do
    # get directory name of the subrepo
    subrepo_dir=$(echo $subrepo | sed -e 's/^\.\///')

    # get the last part of the subrepo name
    subrepo_name=$(echo $subrepo_dir | sed -e 's/.*\///')

    echo "Subrepo: $subrepo_dir"
    # if $package_json is set, find the "name" field in the package.json file
    # and use that as the subrepo name
    if [ $package_json ]; then
        echo "Using package.json name field"
        package_json_name=$(cat $subrepo/$package_json | grep -oP '"name": "\K[^"]+' | sed -e 's/\///')
        echo $package_json_name
        package_json_topics=$(cat $subrepo/$package_json | sed -z "s/\n//g" | grep -oP '"keywords": \[\K[^]]+')
        echo $package_json_topics
        package_json_description=$(cat $subrepo/$package_json | grep -oP '"description": "\K[^"]+')
        echo $package_json_description

        if [ $name ]; then
            subrepo_name=$package_json_name
        else
            echo "!! No name field in package.json for $subrepo_dir !!"
            echo "Skipping $subrepo_dir"
            continue
        fi

    fi

    echo "Splitting $subrepo_dir"

    # create a new bare repo
    cd $base/$subrepo_dir

    git init

    git config --global --add safe.directory /github/workspace/$subrepo_dir

    # git-filter-repo it
    /git-filter-repo --subdirectory-filter $subrepo_dir --force --source "$base/.git" --target "$base/$subrepo_dir/.git"
    echo '/git-filter-repo --subdirectory-filter $subrepo_dir --force --source "$base/.git" --target "$base/$subrepo_dir/.git"'

    git add .

    # check if the subrepo is already on github
    # if it isnt, create it, and add it as the remote
    if [[ ! "$EXISTING_REPOS" =~ "$subrepo_name" ]]; then

        echo "Creating repo $subrepo_name"
        echo 'curl -L \
            -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer $token" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/orgs/$username/repos \ 
        -d "{\"name\":\"$subrepo_name\"}"'
        curl -L -X POST -H "Accept: application/vnd.github+json" -H "Authorization: Bearer $token" -H "X-GitHub-Api-Version: 2022-11-28" https://api.github.com/orgs/$username/repos -d "{\"name\":\"$subrepo_name\", \"hasIssues\": false, \"hasProjects\": false, \"hasWiki\": false, \"isTemplate\": false, \"auto_init\": false, \"private\": false, \"allow_squash_merge\": true, \"allow_merge_commit\": true, \"allow_rebase_merge\": true, \"delete_branch_on_merge\": true, \"archived\": false, \"visibility\": \"public\"}"

    #    curl -u $username https://api.github.com/user/repos -d '{"name":"'$subrepo_name'"}'
    #    git remote add origin
    #    git remote set-url origin "https://github.com/$username/$subrepo_name.git"
    fi

    if [ $topics ]; then
        lowercase_topics=($(echo $package_json_topics | tr '[:upper:]' '[:lower:]'))
        curl \
            -X PUT \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer $token" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/repos/$username/$subrepo_name/topics \
            -d "{\"names\":[$lowercase_topics]]}"
    fi

    if [ $description ]; then
        curl \
            -X PATCH \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer $token" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/repos/$username/$subrepo_name -d "{\"description\":\"$pack_json_description\"}"
    fi

    # push the subrepo to github
    git remote add origin "$gitrepostart$subrepo_name.git"
    git push -u origin --all --force
    git push -u origin --tags --force

    cd $base
done
 */

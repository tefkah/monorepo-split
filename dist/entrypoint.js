#!/usr/bin/env ts-node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/entrypoint.ts
var core2 = __toESM(require("@actions/core"));

// src/split-repo.ts
var core = __toESM(require("@actions/core"));
var import_glob = require("glob");
var import_plugin_throttling = require("@octokit/plugin-throttling");
var import_path = __toESM(require("path"));
var import_promises = __toESM(require("fs/promises"));
var import_child_process = require("child_process");
var import_util = require("util");
var import_rest = require("@octokit/rest");
var import_python_shell = require("python-shell");
var error = typeof (core == null ? void 0 : core.setFailed) === "function" ? core.setFailed : console.error;
var log = typeof (core == null ? void 0 : core.info) === "function" ? core.info : console.log;
var warn = typeof (core == null ? void 0 : core.warning) === "function" ? core.warning : console.warn;
function splitRepo(options) {
  return __async(this, null, function* () {
    var _a, _b;
    const {
      username: username2,
      force: force2,
      token: token2,
      match: match2,
      filter: filter2,
      root: root2,
      packageJson: packageJson2,
      metaJson: metaJson2,
      source: source2,
      topics: topics2 = true,
      description: description2 = true,
      org: org2,
      help,
      gitFilterRepo: gitFilterRepo2 = "/git-filter-repo",
      dev
    } = options;
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
--help, boolean, print help`);
      process.exit(0);
    }
    if (!match2) {
      error("Please supply a match glob!");
      return;
    }
    if (!username2 && !org2) {
      error("Please supply a username or org");
      return;
    }
    if (!token2) {
      error("No token was set, please supply a token");
      return;
    }
    const orgOrUser = org2 || username2;
    if (!orgOrUser) {
      core.setFailed("Please supply a username or org");
      return;
    }
    log(orgOrUser);
    const ThrottledOctokit = import_rest.Octokit.plugin(import_plugin_throttling.throttling);
    const octokit = new ThrottledOctokit({
      auth: token2,
      throttle: {
        onRateLimit: (retryAfter, options2) => {
          warn(
            `Request quota exhausted for request ${options2.method} ${options2.url}`
          );
          if (options2.request.retryCount <= 2) {
            log(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
        onSecondaryRateLimit: (retryAfter, options2) => {
          warn(
            `Secondary rate limit triggered for request ${options2.method} ${options2.url}`
          );
          if (options2.request.retryCount <= 2) {
            log(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        }
      }
    });
    log({ octokit });
    if (metaJson2) {
      log("Using meta.json file");
    } else if (packageJson2) {
      log("Using package.json file");
    }
    const meta = packageJson2 ? "package.json" : metaJson2;
    const existingRepos = org2 ? yield octokit.repos.listForOrg({ org: orgOrUser }) : yield octokit.repos.listForAuthenticatedUser();
    log(existingRepos);
    const existingRepoNames = (_b = (_a = existingRepos == null ? void 0 : existingRepos.data) == null ? void 0 : _a.map((repo) => repo.name)) != null ? _b : [];
    log(existingRepoNames);
    const globs = match2.split(" ");
    const base = root2 ? import_path.default.join(process.cwd(), root2) : process.cwd();
    const subrepos = meta ? yield (0, import_glob.glob)(
      globs.map((glb) => `${glb}/${meta}`),
      { cwd: base }
    ) : yield (0, import_glob.glob)(globs, { cwd: base });
    log(subrepos);
    const fitleredSubrepos = filter2 ? subrepos.filter((subrepo) => {
      if (subrepo.match(filter2)) {
        core.debug(`Filtered out ${subrepo}`);
        return false;
      }
      return true;
    }) : subrepos;
    log(fitleredSubrepos);
    const execAsync = (0, import_util.promisify)(import_child_process.exec);
    log(base);
    try {
      const { stdout, stderr } = yield execAsync(`
  cd ${base}
  ${dev ? "" : `
git config user.email "tefkah-actions-monorepo-split@example.org"
git config user.name "${orgOrUser}"

git config --global init.defaultBranch main
git config --global --add safe.directory ${base}/${source2 != null ? source2 : ".git"}
git config --global --add safe.directory ${base}

git for-each-ref --format '%(refname:short)' refs/heads | grep -v "main" | xargs git branch -D
`}`);
      log(stdout);
      log(stderr);
    } catch (e) {
      log(e);
    }
    log(fitleredSubrepos);
    log(base);
    const loop = yield Promise.all(
      fitleredSubrepos.map((subrepo) => __async(this, null, function* () {
        const subrepoDir = import_path.default.dirname(subrepo);
        const subrepoName = import_path.default.basename(subrepoDir.replace(meta != null ? meta : "", ""));
        const { stdout: touched } = yield execAsync(`
    cd ${base}
    git log -1 --name-only ${import_path.default.join(base, subrepoDir)}
  `);
        log(touched);
        if (!touched && !dev && !force2) {
          log(
            `Skipping ${subrepoName} as it was not touched by the latest commit`
          );
          return;
        }
        const metadata = meta ? JSON.parse(yield import_promises.default.readFile(import_path.default.join(base, subrepo), "utf8")) : {};
        log(metadata);
        const {
          name: metaName,
          description: metaDescription,
          keywords: metaTopics
        } = metadata;
        const repoName = metaName || subrepoName;
        log("base", base);
        log(subrepo, import_path.default.join(base, subrepoDir));
        try {
          const { stdout: out, stderr: err } = yield execAsync(`
    cd ${import_path.default.join(base, subrepoDir)}

    git init

    ${dev ? "" : `git config --global --add safe.directory ${import_path.default.join(
            base,
            subrepoDir
          )}`}
`);
          const gfrCommand = `${dev ? import_path.default.join(base, gitFilterRepo2) : "/git-filter-repo"}`;
          const filterRepoArgs = [
            "--subdirectory-filter",
            subrepoDir,
            "--force",
            "--source",
            import_path.default.join(base, source2 != null ? source2 : ".git"),
            "--target",
            import_path.default.join(base, subrepoDir, ".git")
          ];
          log(`Git-filter-repo command: ${gfrCommand}${filterRepoArgs.join(" ")}`);
          const fitlerRepo = yield import_python_shell.PythonShell.run(gfrCommand, {
            args: filterRepoArgs
          });
          log(fitlerRepo);
          log(out);
          log(err);
          log("Finishd git-filter-repo");
          const { stdout, stderr } = yield execAsync(
            `
      git add .  ${import_path.default.join(base, subrepoDir)}
      `,
            {
              cwd: import_path.default.join(base, subrepoDir)
            }
          );
          log(stdout);
          log(stderr);
        } catch (e) {
          log(e);
        }
        if (!existingRepoNames.includes(repoName)) {
          try {
            yield octokit.rest.repos.createForAuthenticatedUser({
              name: repoName
            });
          } catch (e) {
            log(e);
          }
        }
        if (topics2 && metaTopics) {
          const replaceTopics = yield octokit.rest.repos.replaceAllTopics({
            owner: orgOrUser,
            repo: repoName,
            names: metaTopics
          });
          log(replaceTopics);
        }
        if (description2 && metaDescription) {
          const replacedDescription = yield octokit.rest.repos.update({
            owner: orgOrUser,
            repo: repoName,
            description: metaDescription
          });
          log(replacedDescription);
        }
        try {
          const { stderr, stdout } = yield execAsync(`
    git remote add origin https://$username:${token2}@github.com/$orgOrUser/$repoName.git
    git push -u origin main --force

    cd ${base}
    `);
          log(stdout);
          return stdout;
        } catch (e) {
          log(e);
        }
        return;
      }))
    );
  });
}

// src/entrypoint.ts
core2 == null ? void 0 : core2.setSecret("token");
var username = core2.getInput("username");
var token = core2.getInput("token", { required: true });
var match = core2.getInput("match", { required: true });
var filter = core2.getInput("filter") || "";
var packageJson = core2.getBooleanInput("package-json");
var metaJson = core2.getInput("meta-json");
var topics = core2.getBooleanInput("topics");
var description = core2.getBooleanInput("description");
var org = core2.getInput("org");
var gitFilterRepo = core2.getInput("git-filter-repo");
var source = core2.getInput("source");
var root = core2.getInput("root");
var force = core2.getBooleanInput("force");
splitRepo({
  username,
  token,
  force: Boolean(force),
  match,
  filter,
  packageJson: Boolean(packageJson),
  metaJson,
  topics: Boolean(topics),
  description: Boolean(description),
  org,
  root,
  gitFilterRepo: "/git-filter-repo"
});

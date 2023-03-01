import { splitRepo, Options } from "../src/split-repo"
import { Octokit } from "@octokit/rest"

import { config } from "dotenv"
config()

const options: Options = {
  org: "TrialAndErrorOrg",
  token: process.env.ACCESS_TOKEN,
  packageJson: true,
  match: "libs/texast/*",
  source: "git",
  root: "__tests__/fixtures",
  gitFilterRepo: "../../git-filter-repo",
  dev: true,
}

const x: any = null
const splittedRepo = splitRepo(options, x)

console.log(splittedRepo)

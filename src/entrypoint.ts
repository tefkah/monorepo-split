#!/usr/bin/env ts-node

import * as core from "@actions/core"
import { splitRepo } from "./split-repo"

core?.setSecret("token")

const username: string | undefined = core.getInput("username")
const token: string = core.getInput("token", { required: true })
const match: string = core.getInput("match", { required: true })
const filter: string | undefined = core.getInput("filter") || ""
const packageJson: boolean | undefined = core.getBooleanInput("package-json")
const metaJson: string | undefined = core.getInput("meta-json")
const topics: boolean | undefined = core.getBooleanInput("topics")
const description: boolean | undefined = core.getBooleanInput("description")
const org: string | undefined = core.getInput("org")
const gitFilterRepo = core.getInput("git-filter-repo")
const source = core.getInput("source")
const root = core.getInput("root")
const force = core.getBooleanInput("force")

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
  gitFilterRepo: "/git-filter-repo",
})

// Parse command line arguments using minimist

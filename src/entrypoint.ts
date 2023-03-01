#!/usr/bin/env ts-node

import core from "@actions/core"
import { splitRepo } from "./split-repo"

const username: string | undefined = core.getInput("username")
const token: string = core.getInput("token", { required: true })
const match: string = core.getInput("match", { required: true })
const filter: string | undefined = core.getInput("filter") || "*"
const packageJson: string | undefined = core.getInput("package-json")
const metaJson: string | undefined = core.getInput("meta-json")
const topics: string | undefined = core.getInput("topics")
const description: string | undefined = core.getInput("description")
const org: string | undefined = core.getInput("org")
const help = core.getInput("help")
const gitFilterRepo = core.getInput("git-filter-repo")
const source = core.getInput("source")
const root = core.getInput("root")

splitRepo({
  username,
  token,
  match,
  filter,
  packageJson: Boolean(packageJson),
  metaJson,
  topics: Boolean(topics),
  description: Boolean(description),
  org,
  help: Boolean(help),
  gitFilterRepo,
  source,
  root,
})

// Parse command line arguments using minimist

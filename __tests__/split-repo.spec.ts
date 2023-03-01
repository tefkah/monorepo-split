import { exec } from "child_process"
import { promisify } from "util"

import { join } from "path"

const execAsync = promisify(exec)

describe("splitRepo", () => {
  jest.setTimeout(300000)
  const repoDirs = [
    ["texast"],
    ["texast-util-to-latex"],
    ["texast-util-add-preamble"],
  ]

  it.each(repoDirs)("should have clean git status for %s", async (dir) => {
    const path = join(process.cwd(), "__tests__/fixtures/libs/texast", dir)
    console.log(path)
    const { stdout: status } = await execAsync(`cd ${path} &&  git status`)
    expect(status).toEqual(
      "On branch main\nnothing to commit, working tree clean\n"
    )

    const { stdout: log } = await execAsync(`cd ${path} &&  git log`)
    const logs = log.split("commit")

    console.log(logs)

    expect(logs.length).toBeGreaterThan(2)
  })
})

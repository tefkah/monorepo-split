# Monorepo Split

`monorepo-split` is a GitHub action that syncs a monorepo with a set of
sub-repos. It is designed to be used with GitHub Actions.

## Use case

Imagine you have a large monorepo with many sub-repos.
While the DX of a monorepo is great, the discoverability of a monorepo is not.

`monorepo-split` allows you to split your monorepo into a set of sub-repos on GitHub.
This way it is much easier for people to find your specific library rather than digging through
the monorepo.

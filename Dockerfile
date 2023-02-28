FROM python

LABEL repository="https://github.com/tefkah/actions-split-monorepo"
LABEL homepage="https://github.com/johno/actions-split-monorepo"
LABEL maintainer="Thomas F. K. Jorna <hello@tefkah.com>"

LABEL com.github.actions.name="GitHub Action to Split a Monorepo into Multiple Repositories"
LABEL com.github.actions.description="Automatically push subdirectories in a monorepo to their own repositories"
LABEL com.github.actions.icon="package"
LABEL com.github.actions.color="purple"


RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git 


RUN git config --system --add safe.directory /github/workspace
RUN git config --system --add safe.directory /github/workspace/.git

RUN git config --system --add safe.directory /tmp/monorepo_split/build_directory

RUN git config --global init.defaultBranch main

COPY git-filter-repo /git-filter-repo
COPY entrypoint.sh /entrypoint.sh

COPY . .

RUN chmod +x /entrypoint.sh
RUN chmod +x /git-filter-repo


ENTRYPOINT ["/entrypoint.sh"]
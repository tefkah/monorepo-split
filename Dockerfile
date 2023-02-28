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

COPY "entrypoint.sh" "/entrypoint.sh"
COPY "git-filter-repo" "/git-filter-repo"

ENTRYPOINT ["/entrypoint.sh"]
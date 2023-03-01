FROM ubuntu
RUN apt-get update &&\
    apt-get install git -y &&\
    apt-get install python3 -y && \
    apt-get install curl -y 

RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash
RUN  apt-get install -y nodejs 

LABEL repository="https://github.com/tefkah/actions-split-monorepo"
LABEL homepage="https://github.com/johno/actions-split-monorepo"
LABEL maintainer="Thomas F. K. Jorna <hello@tefkah.com>"

LABEL com.github.actions.name="GitHub Action to Split a Monorepo into Multiple Repositories"
LABEL com.github.actions.description="Automatically push subdirectories in a monorepo to their own repositories"
LABEL com.github.actions.icon="package"
LABEL com.github.actions.color="purple"




RUN git config --system --add safe.directory /github/workspace
RUN git config --system --add safe.directory /github/workspace/.git

RUN git config --system --add safe.directory /tmp/monorepo_split/build_directory

RUN git config --global init.defaultBranch main

COPY git-filter-repo /git-filter-repo
COPY dist/entrypoint.js /entrypoint.js
COPY package.json /package.json

RUN node -v
RUN npm install


RUN chmod +x entrypoint.js
RUN chmod +x git-filter-repo


ENTRYPOINT ["node", "entrypoint.js"]
#!/bin/bash
# find all the subdirectories with a package.json file
# and create a list of them
# then split the repo into those subdirectories
# and push them to github
# Usage: repo-split.sh <github repo url> <github username>

# parse a number of arguments
# required
# --username, string, github username
# --token, string, github token
# --match, string, regex to match the subrepo name
# optional
# --filter, string, regex to filter the subrepo name
# --package-json, boolean, use the name field and other attributes in the package.json file as the subrepo name
# --meta-json, string, file path to a json file (relative to the subrepo) with the name, description, and topics of the subrepo
# --topics, boolean, set the topics of the repository using the topics field in the package/meta.json file
# --description, boolean, set the description of the repository using the description field in the package/meta.json file
# --org, string, use the org name instead of the username
# --help, boolean, print help

set -x

filter="*"

# get the arguments
while [ $# -gt 0 ]; do
    key="$1"

    case $key in
    --username)
        username="$2"
        shift # past argument
        shift # past value
        ;;
    --token)
        token="$2"
        shift # past argument
        shift # past value
        ;;
    --match)
        match="$2"
        shift # past argument
        shift # past value
        ;;
    --filter)
        filter="$2"
        shift # past argument
        shift # past value
        ;;
    --package-json)
        package_json="$2"
        shift # past argument
        shift # past value
        ;;
    --meta-json)
        meta_json="$2"
        shift # past argument
        shift # past value
        ;;
    --name)
        name="$2"
        shift # past argument
        shift # past value
        ;;
    --topics)
        topics="$2"
        shift # past argument
        shift # past value
        ;;
    --description)
        description="$2"
        shift # past argument
        shift # past value
        ;;
    --org)
        org="$2"
        shift # past argument
        shift # past value
        ;;
    --help)
        echo "Usage: repo-split.sh <github repo url> <github username>"
        echo "Options:"
        echo "--username, string, github username"
        echo "--token, string, github token"
        echo "--match, string, glob expression for matching the wanted subrepos name. Can be used multiple times"
        echo "--filter, string, regex to filter the subrepo name. Only things that match the match and do not match the filter regex will be used"
        echo "--package-json, boolean, use the name field in the package.json file as the subrepo name"
        echo "--org, string, use the org name instead of the username"
        echo "--help, boolean, print help"
        exit 0
        ;;
    *)        # unknown option
        shift # past argument
        ;;
    esac
done

if [ ! "$match" ]; then
    echo "Please supply a match regex!"
    exit 1
fi

if [ $meta_json ]; then
    echo "Using meta.json file"
    package_json=meta_json
else
    if [ $package_json ]; then
        echo "Using package.json file"
        package_json='package.json'
    fi
fi

# get the repo url
# repo=$1
# get the github username
# username=$1

# get the repo name
repo_name=$(echo $repo | sed -e 's/.*\///')

# get the repo name without the .git
repo_name=$(echo $repo_name | sed -e 's/\.git//')

# if a token is not set, throw an error
if [[ ! $token ]]; then
    echo "No token was set, please supply a token"
    exit 1
fi

echo $org
if [[ ! $username && ! $org ]]; then
    echo "Please supply a username or org"
    exit 1
fi

# if org is set, use the org name
if [[ $org ]]; then
    username=$org
    curlurl="https://api.github.com/orgs/$org/repos"
    create_repo_url="https://api.github.com/orgs/$org/repos"
else
    curlurl="https://api.github.com/users/$username/repos"
    create_repo_url="https://api.github.com/user/repos"
fi

gitrepostart="https://$username:$token@github.com/$username/"

EXISTING_REPOS=$(curl -s 0 | grep -oP '    "name": "\K[^"]+"')

git config user.email "tefkah-actions-monorepo-split@example.org"
git config user.name "$username"
# set token as git password
git config --global credential.helper "store --file=.git/credentials"

# remove all other branches than main
git for-each-ref --format '%(refname:short)' refs/heads | grep -v "master\|main" | xargs git branch -D

echo $EXISTING_REPOS
base=$PWD

# find all the subdirectories that match a glob expression

if [ $package_json ]; then
    echo "Only using subdirectories with a $package_json file"
    echo "$match"
    echo "$filter"
    subrepos=$(echo $match)
    echo $subrepos
    if [ ! "$subrepos" ]; then
        echo "No subrepos found"
        exit 1
    fi
    # subrepos=$(find ( $subrepos ) -name package.json | sed -e 's/\/package.json//')
    temp=
    echo $subrepos | while read -d $'\0' file; do
        echo $file
        if [ -f "$file/$package_json" ]; then
            temp="$temp $file"
        fi
    done
    $subrepos=$temp

else
    subrepos=$(echo $match)
fi

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
    git push -u origin --all
    git push -u origin --tags

    cd $base
done

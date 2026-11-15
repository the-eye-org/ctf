pipeline {
    agent { label 'students' }
    options { disableConcurrentBuilds() }
    parameters {
        booleanParam(name: 'RESTORE_EXISTING_DATA', defaultValue: false, description: 'First migration only: restore ctf-migration-archive into an empty database')
    }
    environment {
        REGISTRY = 'ghcr.io'
        GHCR_REPO = 'ghcr.io/the-eye-org/ctf'
        IMAGE_TAG = 'latest'
        IMAGE_REF = 'ghcr.io/the-eye-org/ctf:latest'
        DOCKER_CREDS = credentials('psgdcgit')


    }
    stages {
        stage('Login to GHCR') {
            steps { sh '''
                set +x
                printf '%s' "$DOCKER_CREDS_PSW" | docker login "$REGISTRY" -u "$DOCKER_CREDS_USR" --password-stdin
            ''' }
        }
        stage('Pull Docker Image') {
            steps { sh 'docker pull "$GHCR_REPO:$IMAGE_TAG"' }
        }
        stage('Prepare Compose') {
            steps { sh '''
                set -eu
                set +x
                docker compose version
                mkdir -p .ctf-deploy
                HOLDER=$(docker create "$GHCR_REPO:$IMAGE_TAG")
                trap 'docker rm "$HOLDER" >/dev/null' EXIT
                docker cp "$HOLDER:/app/compose.yaml" .ctf-deploy/compose.yaml
                docker run --rm --entrypoint node "$GHCR_REPO:$IMAGE_TAG" -e '
                    const values = require("/app/runtime-env.json");
                    const url = new URL(values.DATABASE_URL);
                    if (url.hostname !== "db" || url.username !== "ctf" || url.pathname !== "/ctf") throw new Error("Expected internal PostgreSQL URL: ctf@db:5432/ctf");
                    values.POSTGRES_PASSWORD = decodeURIComponent(url.password);
                    values.IMAGE_REF = "ghcr.io/the-eye-org/ctf:latest";
                    for (const [key, value] of Object.entries(values)) console.log(key + "=" + JSON.stringify(value));
                ' > .ctf-deploy/runtime.env
                chmod 600 .ctf-deploy/runtime.env
                export IMAGE_REF="$GHCR_REPO:$IMAGE_TAG"
                docker compose -p ctf --env-file .ctf-deploy/runtime.env -f .ctf-deploy/compose.yaml config --quiet
            ''' }
        }
        stage('Start PostgreSQL') {
            steps { sh '''
                set -eu
                set +x
                export IMAGE_REF="$GHCR_REPO:$IMAGE_TAG"
                # Transfer ownership from the previous docker-run deployment without deleting data.
                if docker container inspect ctf-db >/dev/null 2>&1; then
                    docker stop ctf-db >/dev/null
                    docker rm ctf-db >/dev/null
                fi
                docker compose -p ctf --env-file .ctf-deploy/runtime.env -f .ctf-deploy/compose.yaml up -d --wait db
            ''' }
        }
        stage('Apply Database Migrations') {
            steps { sh '''
                set -eu
                set +x
                TEMP_DIR=$(mktemp -d)
                HOLDER=$(docker create "$GHCR_REPO:$IMAGE_TAG")
                trap 'docker rm "$HOLDER" >/dev/null; rm -rf "$TEMP_DIR"' EXIT
                docker cp "$HOLDER:/app/db/migrations" "$TEMP_DIR/migrations"
                docker compose -p ctf --env-file .ctf-deploy/runtime.env -f .ctf-deploy/compose.yaml exec -T db psql -U ctf -d ctf -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA IF NOT EXISTS migrations; CREATE TABLE IF NOT EXISTS migrations.applied(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());'
                for file in "$TEMP_DIR"/migrations/*.sql; do
                    name=$(basename "$file")
                    applied=$(docker compose -p ctf --env-file .ctf-deploy/runtime.env -f .ctf-deploy/compose.yaml exec -T db psql -U ctf -d ctf -Atc "SELECT count(*) FROM migrations.applied WHERE name='$name'")
                    if [ "$applied" = 0 ]; then
                        { printf 'BEGIN;\n'; cat "$file"; printf "\nINSERT INTO migrations.applied(name) VALUES ('%s');\nCOMMIT;\n" "$name"; } | docker compose -p ctf --env-file .ctf-deploy/runtime.env -f .ctf-deploy/compose.yaml exec -T db psql -U ctf -d ctf -v ON_ERROR_STOP=1
                    fi
                done
            ''' }
        }
        stage('Restore Existing Data') {
            when { expression { params.RESTORE_EXISTING_DATA } }
            steps {
                withCredentials([file(credentialsId: 'ctf-migration-archive', variable: 'MIGRATION_ARCHIVE')]) {
                    sh '''
                        set -eu
                        set +x
                        TEMP_DIR=$(mktemp -d)
                        trap 'rm -rf "$TEMP_DIR"' EXIT
                        tar -xzf "$MIGRATION_ARCHIVE" -C "$TEMP_DIR"
                        docker compose -p ctf --env-file .ctf-deploy/runtime.env -f .ctf-deploy/compose.yaml exec -T db psql -U ctf -d ctf -v ON_ERROR_STOP=1 < "$TEMP_DIR/app-data.sql"
                        if [ -d "$TEMP_DIR/storage/workspaces" ]; then
                            docker run --rm --entrypoint sh -v ctf_workspace_data:/target \
                                -v "$TEMP_DIR/storage/workspaces:/source:ro" "$GHCR_REPO:$IMAGE_TAG" -c 'cp -a /source/. /target/'
                        fi
                    '''
                }
            }
        }
        stage('Stop Existing Container') {
            steps { sh '''
                if [ -n "$(docker ps -aq -f name=^/signalxshift$)" ]; then
                    docker rm -f signalxshift
                fi
            ''' }
        }
        stage('Run Container') {
            steps { sh '''
                set -eu
                set +x
                docker compose -p ctf --env-file .ctf-deploy/runtime.env -f .ctf-deploy/compose.yaml up -d app
                docker compose -p ctf --env-file .ctf-deploy/runtime.env -f .ctf-deploy/compose.yaml ps
            ''' }
        }
    }

    post {
        always { sh 'set +x; rm -f .ctf-deploy/runtime.env; docker logout ghcr.io' }
        success { echo 'CTF container started on port 8005 with local PostgreSQL.' }
        failure { echo 'Deployment failed. Check logs; persistent volumes are retained.' }
    }
}

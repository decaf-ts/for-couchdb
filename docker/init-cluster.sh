#!/bin/bash -e

echo "Booting clustered"

source .env

DEPLOYMENT_NAME=${COMPOSE_PROJECT_NAME}
IFS=","
COORDINATOR_NODE="0"

OUTER_PORT=$([ -z "$COORDINATOR_HOST" ] && echo "${PORT_BASE}0" || echo "5984")

COORDINATOR_HOST=$([ -z "$COORDINATOR_HOST" ] && echo "127.0.0.1" || echo "$COORDINATOR_HOST")
REPLICA1_HOST=$([ -z "$REPLICA1_HOST" ] && echo "127.0.0.1" || echo "$REPLICA1_HOST")
REPLICA2_HOST=$([ -z "$REPLICA2_HOST" ] && echo "127.0.0.1" || echo "$REPLICA2_HOST")
ADDITIONAL_NODES="1,2"
ALL_NODES="${COORDINATOR_NODE},${ADDITIONAL_NODES}"
HOSTS=("${COORDINATOR_HOST}" "${REPLICA1_HOST}" "${REPLICA2_HOST}")


# check if already running and clustered, and if so, exit
curl -s "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COORDINATOR_HOST}:${OUTER_PORT}/_cluster_setup"
STATUS=$(curl -s "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COORDINATOR_HOST}:${OUTER_PORT}/_cluster_setup")

if [[ "$STATUS" =~ "cluster_finished" ]]; then
  echo "Cluster already set up"
  exit 0
else
  echo "Setting up cluster"
fi

# https://docs.couchdb.org/en/stable/setup/single-node.html

for NODE_ID in $ALL_NODES
do
  PORT=$([ "$OUTER_PORT" == "5984" ] && echo "$OUTER_PORT" || echo "${PORT_BASE}${NODE_ID}")
  curl -X PUT "${COUCHDB_USER}:${COUCHDB_PASSWORD}@${HOSTS[${NODE_ID}]}:${PORT}/_users"
  curl -X PUT "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${HOSTS[${NODE_ID}]}:${PORT}/_replicator"
done

# see https://docs.couchdb.org/en/master/setup/cluster.html

for NODE_ID in $COORDINATOR_NODE
do
  curl -X POST -H "Content-Type: application/json" "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COORDINATOR_HOST}:${OUTER_PORT}/_cluster_setup" \
  -d '{"action": "enable_cluster", "bind_address":"0.0.0.0", "username": "'"${COUCHDB_USER}"'", "password":"'"${COUCHDB_USER}"'", "node_count":"3"}'
  echo You may safely ignore the warning above.
done

for NODE_ID in $ADDITIONAL_NODES
do
  curl -X POST -H "Content-Type: application/json" "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COORDINATOR_HOST}:${OUTER_PORT}/_cluster_setup" -d '{"action": "enable_cluster", "bind_address":"0.0.0.0", "username": "'"${COUCHDB_USER}"'", "password":"'"${COUCHDB_PASSWORD}"'", "port": 5984, "node_count": "3", "remote_node": "'"replica-${NODE_ID}.${DEPLOYMENT_NAME}"'", "remote_current_user": "'"${COUCHDB_USER}"'", "remote_current_password": "'"${COUCHDB_PASSWORD}"'" }'
  curl -X POST -H "Content-Type: application/json" "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COORDINATOR_HOST}:${OUTER_PORT}/_cluster_setup" -d '{"action": "add_node", "host":"'"replica-${NODE_ID}.${DEPLOYMENT_NAME}"'", "port": 5984, "username": "'"${COUCHDB_USER}"'", "password":"'"${COUCHDB_PASSWORD}"'"}'
done

curl -s "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COORDINATOR_HOST}:${OUTER_PORT}/_cluster_setup"

curl -s "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@${COORDINATOR_HOST}:${OUTER_PORT}/_membership"


echo Your cluster nodes are available at:
for NODE_ID in ${ALL_NODES}
do
  PORT=$([ "$OUTER_PORT" == "5984" ] && echo "$OUTER_PORT" || echo "${PORT_BASE}${NODE_ID}")
  echo "http://${COUCHDB_USER}:<password>@${HOSTS[${NODE_ID}]}:${PORT}"
done
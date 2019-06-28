#!/usr/bin/env bash
[[ ! -z $1 ]] && DIGEST_SIZE=$1 || DIGEST_SIZE=256
MANIFEST_FILE="manifest-gen-$DIGEST_SIZE.txt"
[[ -f ${MANIFEST_FILE} ]] && rm ${MANIFEST_FILE} && touch ${MANIFEST_FILE}

[[ `uname -a | grep -c "Darwin"` -gt 0 ]] && SHASUM="shasum" || SHASUM="sha"${DIGEST_SIZE}"sum"
for FILE in *; do
    [[ ! -d "${FILE}" ]] && echo `${SHASUM} -a ${DIGEST_SIZE} "${FILE}"` >> ${MANIFEST_FILE}
done

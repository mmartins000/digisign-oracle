#!/usr/bin/env bash
# Generate a test key pair
# From: https://www.gnupg.org/documentation/manuals/gnupg/Unattended-GPG-key-generation.html
export GNUPGHOME="$(mktemp -d)"
cat >foo <<EOF
     %echo Generating a default key
     Key-Type: default
     Subkey-Type: default
     Name-Real: Joe Tester
     Name-Comment: with stupid passphrase
     Name-Email: joe@foo.bar
     Expire-Date: 0
     Passphrase: abc
     # Do a commit here, so that we can later print "done" :-)
     %commit
     %echo done
EOF
gpg --batch --generate-key foo
gpg --list-secret-keys

# Generate all manifests
for DIGEST_SIZE in 1 224 256 384 512; do
    MANIFEST_FILE="manifest-dummy-$DIGEST_SIZE.txt"
    MANIFEST_MOD_FILE="manifest-dummy-modified-$DIGEST_SIZE.txt"
    [[ -f ${MANIFEST_FILE} ]] && rm ${MANIFEST_FILE} && touch ${MANIFEST_FILE}

    [[ `uname -a | grep -c "Darwin"` -gt 0 ]] && SHASUM="shasum" || SHASUM="sha"${DIGEST_SIZE}"sum"
    for FILE in *; do
        [[ ! -d ${FILE} ]] && echo `${SHASUM} -a ${DIGEST_SIZE} ${FILE}` >> ${MANIFEST_FILE}
    done
    sed 's/9/0/g' ${MANIFEST_FILE} > ${MANIFEST_MOD_FILE}

    # Use the test private key to sign the manifests
    gpg --homedir ${GNUPGHOME} --batch --passphrase abc --pinentry-mode loopback --output ${MANIFEST_FILE}.sig --armor --detach-sig ${MANIFEST_FILE}
    sed 's/C/F/g' ${MANIFEST_FILE}.sig > ${MANIFEST_MOD_FILE}.sig
done
gpg --homedir ${GNUPGHOME} --batch --export --armor --output tester.key

# Remove the test keys.
rm -fR ${GNUPGHOME}

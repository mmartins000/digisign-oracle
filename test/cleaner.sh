#!/usr/bin/env bash
for FILE in *; do
    [[ ${FILE} =~ manifest-dummy-[0-9]{1,3}\.txt[\.sig]? ]] && rm ${FILE}
    [[ ${FILE} =~ manifest-dummy-modified-[0-9]{1,3}\.txt[\.sig]? ]] && rm ${FILE}
done
[[ -f foo ]] && rm foo
[[ -f tester.key ]] && rm tester.key

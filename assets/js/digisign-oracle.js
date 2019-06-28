$(document).ready(function() {
    function setTheme(theme) {
        // Ref: https://wdtz.org/bootswatch-theme-selector.html
        $('link[title="main"]').attr('href', theme);
        if (theme.includes('default')) {    // toggleClass didn't work as expected on page reload
            $('img').removeClass("inverted");
            $('svg').removeClass("inverted");
        } else {
            $('img').addClass("inverted");
            $('svg').addClass("inverted");
        }
        if (checkSupportHTML5Storage()) {
            localStorage.theme = theme;     // Saves the selection
        }
    }

    function checkSupportHTML5Storage() {
        try {
            return 'localStorage' in window && window['localStorage'] !== null;
        } catch (e) {
            return false;
        }
    }

    function loadTheme() {
        if (checkSupportHTML5Storage()) {
            let savedTheme = localStorage.theme;
            if (savedTheme) {
                setTheme(savedTheme);
            }
        }
    }

    $('#imgLogo').on("click", function(e) {
        e.preventDefault();
        let theme_name = '';
        if ($('link[title="main"]').attr('href').includes('darkly')) {
            theme_name = "default"
        } else {
            theme_name = "darkly"
        }
        let theme = "assets/css/" + theme_name + "/bootstrap.min.css";
        setTheme(theme);
    });

    function showAlert (txtMessage, alertType, txtStatus, divId="notiAlert") {
        let txtNotiHeader =
            '<div id=' + divId + ' class=\"alert ' + alertType + ' alert-dismissible fade show\" role=\"alert\">' +
            '<h5 class=\"alert-heading\">' + txtStatus + '</h5>';
        let txtNotiBody = '';
        if (txtMessage) {
            txtNotiBody = '<p>' + txtMessage + '</p>';
        }
        let txtNotiBottom =
            '<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">' +
            '<span aria-hidden=\"true\">&times;</span>' +
            '</button>' +
            '</div>';
        let txtNoti = txtNotiHeader + txtNotiBody + txtNotiBottom;
        $('#inside').append(txtNoti);
        $('.alert').alert();
        scrollDiv('inside');
    }

    if (FileReader.prototype.readAsArrayBuffer && FileReader.prototype.readAsBinaryString) {
        FileReader.prototype.readAsArrayBuffer = function readAsArrayBuffer () {
            this.readAsBinaryString.apply(this, arguments);
            this.__defineGetter__('resultString', this.__lookupGetter__('result'));
            this.__defineGetter__('result', function () {
                let string = this.resultString;
                let result = new Uint8Array(string.length);
                for (let i = 0; i < string.length; i++) {
                    result[i] = string.charCodeAt(i);
                }
                return result.buffer;
            });
        };
    }

    let manifestFile, manifestSignatureFile, signatureFile, publicKeyInputFile, packageFile1, packageFile2;
    let manifestAlgo, manifestDigestSize;

    function prepareRead(object) {
        if (document.getElementById(object).files[0]) {
            let fileObject = document.getElementById(object);
            $(document.getElementById(object)).next('.custom-file-label').addClass("selected").html(fileObject.files[0].name);
            if (fileObject)
                progressiveRead(fileObject.files[0], object);
        }
    }

    $('#manifestFile').on('change', function() {
        prepareRead("manifestFile");
    });

    $('#manifestSignatureFile').on('change', function() {
        prepareRead("manifestSignatureFile");
    });

    $('#packageFile1').on('change', function() {
        prepareRead("packageFile1");
    });

    $('#signatureFile').on('change', function() {
        prepareRead("signatureFile");
    });

    $('#packageFile2').on('change', function() {
        prepareRead("packageFile2");
    });

    $('#publicKeyFile').on('change', function() {
        prepareRead("publicKeyFile");
    });

    $('#hkpServer').on('change', function() {
        checkEnableVerify();
    });

    $('#hkpKey').on('change', function() {
        checkEnableVerify();
    });

    $('#infoCircle').on("click", function(e) {
        e.preventDefault();
        let txtInfo =
            '<b>With manifest: </b>' +
            'The manifest is a text file that contains the digest (hashes) for several files.' +
            '<br><br>' +
            '<b>Without manifest: </b>' +
            'You probably have only two files: the signature (with .asc or .sign extension) and the \'signed\' file.' +
            '<br><br>' +
            '<b>Key from server: </b>' +
            'Specifies the HKP server from which the public key will be downloaded. Defaults to keyserver.ubuntu.com' +
            '<br><br>' +
            '<b>Key from file: </b>' +
            'If you have an ASC file with the public key.' +
            '<br><br>' +
            'Note: OpenPGP.js cannot use any imported public key on your system.' +
            '<br><br>' +
            'Check out the article ' +
            '<a href="https://exploitedbunker.com/articles/verifying-digital-signatures/">Verifying digital signatures</a>' +
            ' to learn more.';
        let j = 0;
        $("div[id*='notiAlert']").each(function () {
            // Information is only shown if there is no other 'alert-light' div.
            ($(this).hasClass('alert-light')) && j++;
        });
        (j === 0) && showAlert(txtInfo, 'alert-light', "Info");
    });

    $('#closeCircle').on("click", function(e) {
        e.preventDefault();
        $("div[id*='notiAlert']").each(function () {
            ($(this).alert('close'));
        });
    });

    function showRunningAlert() {
        showAlert("", 'alert-dark', "Running...", "notiRunningAlert");
    }

    function removeRunningAlert() {
        $("div[id*='notiRunningAlert']").each(function () {
            ($(this).alert('close'));
        });
    }

    function showDoneAlert() {
        showAlert("", 'alert-dark', "Done.");
    }

    function hexString(buffer) {
        // From: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
        const byteArray = new Uint8Array(buffer);
        const hexCodes = [...byteArray].map(value => {
            const hexCode = value.toString(16);
            return hexCode.padStart(2, '0');
        });

        return hexCodes.join('');
    }

    function digestMessage(message, algo) {
        // From: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
        return window.crypto.subtle.digest(algo, message);
    }

    function identifyDigest(manifest) {
        // Supports only SHA digests
        // Reference: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
        // First, identify the digest algorithm
        let mySHA = [];
        let digestSize;
        mySHA[0] = /^[0-9a-fA-F]{40}\s/;  // SHA-1   (vulnerable)
        mySHA[1] = /^[0-9a-fA-F]{56}\s/;  // SHA-224 (not supported)
        mySHA[2] = /^[0-9a-fA-F]{64}\s/;  // SHA-256
        mySHA[3] = /^[0-9a-fA-F]{96}\s/;  // SHA-384
        mySHA[4] = /^[0-9a-fA-F]{128}\s/; // SHA-512

        let algo = "";
        for (let i = 0; i < 5; i++) {
            let myRegex = mySHA[i].exec(manifest);
            if (myRegex) {
                if (i === 0) {  //SHA-1
                    console.log("Found SHA-1 digest. This algorithm is now considered vulnerable and should not be used.");
                    showAlert("Found SHA-1 digest. This algorithm is now considered vulnerable and should not be used.", 'alert-warning', "Warning!");
                    algo = "SHA-1";
                    digestSize = 40;
                } else if (i === 1) {  //SHA-224, not supported by window.crypto.subtle.digest()
                    console.log("Found SHA-224 digest. This algorithm is not supported by SubtleCrypto.digest() library.");
                    showAlert("Found SHA-224 digest. This algorithm is not supported by SubtleCrypto.digest() library.", 'alert-danger', "Fail!");
                    algo = "SHA-224";
                    digestSize = 56;
                } else if (i === 2) {
                    algo = "SHA-256";
                    digestSize = 64;
                } else if (i === 3) {
                    algo = "SHA-384";
                    digestSize = 96;
                } else if (i === 4) {
                    algo = "SHA-512";
                    digestSize = 128;
                }
            }
        }
        if (algo === "") {
            console.log("Could not locate a known message digest algorithm (SHA-1, SHA-256, SHA-384 or SHA-512).");
            showAlert("Could not locate a known message digest algorithm (SHA-1, SHA-256, SHA-384 or SHA-512).", 'alert-danger', "Fail!");
            return false
        }
        manifestAlgo = algo;
        manifestDigestSize = digestSize;
        return true
    }

    function verifyDigest(manifest, packageFile, packageFileName, algo, digestSize) {
        // Second, identify the hash that matches the selected package
        let myHash = new RegExp("^([0-9a-fA-F]{" + digestSize + "})\\s(" + packageFileName + ")$", 'gm');
        let myDigest = myHash.exec(manifest);

        // Third, send the package and the algo for verification and compare the results
        if (algo !== "" && algo !== "SHA-224") {
            digestMessage(packageFile, algo).then(digestValue => {
                let packageDigest = hexString(digestValue);
                if (myDigest[1] === packageDigest) {
                    console.log("Found " + algo + " digest. The package digest matches the one found in the manifest for "
                        + packageFileName + ".");
                    showAlert("Found " + algo + " digest. The package digest matches the one found in the manifest for <b>"
                        + packageFileName + "</b>.", 'alert-success', "Success!");
                } else {
                    console.log("Found " + algo + " digest. The package digest " + packageDigest + " did not match the one found in the manifest for "
                        + packageFileName + " (" + myDigest[1] + ").");
                    showAlert("Found " + algo + " digest. The package digest did not match the one found in the manifest for <b>" + packageFileName + "</b>.", 'alert-danger', "Fail!");
                }
                enableVerify();
                removeRunningAlert();
                showDoneAlert();
            });
        } else if (algo === "SHA-224") {
            console.log("Cannot verify if the package digest matches the one found in the manifest because it's a SHA-224 digest, which is not supported by SubtleCrypto.digest() library.");
            showAlert("Cannot verify if the package digest matches the one found in the manifest because it's a SHA-224 digest, which is not supported by SubtleCrypto.digest() library.", 'alert-danger', "Fail!");
        } else {    // algo === ""
            console.log("Could not select an algorithm. We should not reach this piece of code.")
        }
    }

    $('#verify1, #verify2').click(function(e) {
        // Reference: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Synchronous_and_Asynchronous_Requests
        e.preventDefault();

        (async () => {
            let executionManifest = false;
            let manifestFileName, packageFileName;
            if ($('#manifest').hasClass('active')) {
                executionManifest = true;
                // These filenames will be used in the alerts and to search for the right digest inside the manifest.
                manifestFileName = document.getElementById("manifestFile").files[0].name;
                packageFileName = document.getElementById("packageFile1").files[0].name;
            } else {
                packageFileName = document.getElementById("packageFile2").files[0].name;
            }

            listObjective(executionManifest, packageFileName, manifestFileName);

            let openpgp = typeof window != 'undefined' && window.openpgp; // ? window.openpgp : require('openpgp');

            let verOptions, validity, publicKeysRaw;

            if ($('#keyServer').hasClass('active')) {
                // Public key from HKP server
                let hkpServer = document.getElementById("hkpServer").value;
                let hkpKey = document.getElementById("hkpKey").value;

                if (hkpServer && ! hkpServer.startsWith('https:')) {
                    if (hkpServer.startsWith('http:'))
                        hkpServer = hkpServer.replace(/http:/g, 'https:');
                    else
                        hkpServer = "https://" + hkpServer;

                    document.getElementById('hkpServer').value = hkpServer;
                } else if (! hkpServer) {
                    hkpServer = "https://keyserver.ubuntu.com";
                    document.getElementById("hkpServer").value = hkpServer;
                }

                let hkpOptions = "";
                if (hkpKey.includes('@')) {
                    hkpOptions = { query: hkpKey }; // Email
                } else {
                    if (hkpKey.includes('0x'))
                        hkpKey = hkpKey.replace(/0x/g, '');
                    hkpOptions = { keyId: hkpKey }; //Key format 0x
                }

                // Keyring support on OpenPGP.js is still bare-bones
                // https://openpgpjs.org/openpgpjs/doc/module-keyring_keyring-Keyring.html
                // let keyring = new openpgp.Keyring();
                // publicKeysRaw = await keyring.load().then(function() {
                //     if (hkpKey.includes('@'))
                //         keyring.getKeysForId(hkpKey, true);
                //     else
                //         // https://openpgpjs.org/openpgpjs/doc/keyring_keyring.js.html
                //         keyring.getForAddress(hkpKey);
                // });
                // Add ref: https://github.com/openpgpjs/openpgpjs/issues/740

                if (!publicKeysRaw) {   // Keyring: key not found (not supported)
                    // Defaults to https://keyserver.ubuntu.com, or pass another keyserver URL as a string
                    try {
                        let hkp = new openpgp.HKP(hkpServer);
                        let armoredPubkey = await hkp.lookup(hkpOptions);
                        if (armoredPubkey) {
                            let txtKeyFetch = 'Fetched key ID ' + hkpKey + ' from server ' + hkpServer + '.';
                            showAlert(txtKeyFetch, "alert-dark", "Key fetched from server");
                            console.log(txtKeyFetch);
                            publicKeysRaw = armoredPubkey
                        }
                    }
                    catch (e) {
                        console.log(e);
                        showAlert(e, "alert-warning", "Warning!");
                        enableVerify();
                        return
                    }
                }
            } else {  // Public key from file
                publicKeysRaw = publicKeyInputFile;
            }

            try {
                if (executionManifest) {
                    verOptions = {
                        message: await openpgp.message.fromText(manifestFile),
                        signature: await openpgp.signature.readArmored(manifestSignatureFile),
                        publicKeys: (await openpgp.key.readArmored(publicKeysRaw)).keys
                    };
                } else {
                    verOptions = {
                        message: await openpgp.message.fromBinary(packageFile2),
                        signature: await openpgp.signature.readArmored(signatureFile),
                        publicKeys: (await openpgp.key.readArmored(publicKeysRaw)).keys
                    };
                }
            }
            catch (e) {
                console.log(e);
                showAlert(e, "alert-danger", "Fail!");
                enableVerify();
                return
            }

            try {
                openpgp.verify(verOptions).then(function(verified) {
                    validity = verified.signatures[0].valid;
                    console.log(verified.signatures[0]);
                    if (validity) {
                        if (executionManifest) {
                            console.log('Found valid signature for ' + manifestFileName + ' created in ' +
                                verified.signatures[0].signature.packets[0].created + '. Signed by key ID ' +
                                verified.signatures[0].keyid.toHex() + '.');
                            showAlert('Found valid signature for <b>' + manifestFileName + '</b> created in ' +
                                verified.signatures[0].signature.packets[0].created + '. Signed by key ID ' +
                                verified.signatures[0].keyid.toHex() + '.', "alert-success", "Success!");

                            showRunningAlert();
                            // Read (again) to convert to Uint8Array and send to verifyDigest
                            progressiveRead(document.getElementById("packageFile1").files[0],
                                "compareFileMode", packageFileName);

                        } else {
                            console.log('Found valid signature for ' + packageFileName + ' created in ' +
                                verified.signatures[0].signature.packets[0].created + '. Signed by key ID ' +
                                verified.signatures[0].keyid.toHex() + '.');
                            showAlert('Found valid signature for <b>' + packageFileName + '</b> created in ' +
                                verified.signatures[0].signature.packets[0].created + '. Signed by key ID ' +
                                verified.signatures[0].keyid.toHex() + '.', "alert-success", "Success!");
                            showDoneAlert();
                            enableVerify();
                            defaultVerify();
                        }
                    } else {
                        if (executionManifest) {
                            console.log('Found invalid signature for ' + manifestFileName +
                                '. Signed by key ID ' + verified.signatures[0].keyid.toHex() + '.');
                            showAlert('Found invalid signature for <b>' + manifestFileName +
                                '</b>. Signed by key ID ' + verified.signatures[0].keyid.toHex() + '.',
                                "alert-danger", "Fail!");
                        } else {
                            console.log('Found invalid signature for ' + packageFileName +
                                '. Signed by key ID ' + verified.signatures[0].keyid.toHex() + '.');
                            showAlert('Found invalid signature for <b>' + packageFileName +
                                '</b>. Signed by key ID ' + verified.signatures[0].keyid.toHex() + '.',
                                "alert-danger", "Fail!");
                        }
                        enableVerify();
                        defaultVerify();
                    }
                });
            }
            catch (e) {
                console.log(e);
                showAlert(e, "alert-danger", "Fail!");
                enableVerify();
                defaultVerify();
            }
            finally {
                defaultVerify();
            }
        })();
    });

    function scrollDiv(myDiv) {
        let elem = document.getElementById(myDiv);
        elem.scrollTop = elem.scrollHeight;
    }

    function humanFileSize(bytes, si) {
        let thresh = si ? 1000 : 1024;
        if (Math.abs(bytes) < thresh) {
            return bytes + ' B';
        }
        let units = si
            ? ['kB','MB','GB','TB','PB','EB','ZB','YB']
            : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
        let u = -1;
        do {
            bytes /= thresh;
            ++u;
        } while (Math.abs(bytes) >= thresh && u < units.length - 1);

        return bytes.toFixed(1) + ' ' + units[u];
    }

    function listObjective(executionManifest, packageFileName, manifestFileName) {
        if (executionManifest) {
            console.log('Verify the signature for ' + manifestFileName +
                ' and that the hash digest for ' + packageFileName + ' matches the one inside the manifest.');
            showAlert('Verify the signature for <b>' + manifestFileName +
                '</b> and that the hash digest for <b>' + packageFileName + '</b> matches the one inside the manifest.',
                "alert-dark", "Objective");
        } else {
            console.log('Verify the signature for ' + packageFileName + '.');
            showAlert('Verify the signature for <b>' + packageFileName + '</b>.',
                "alert-dark", "Objective");
        }
    }

    function defaultVerify() {
        $('#verify1, #verify2').text("Verify")
    }

    function enableVerify() {
        $('#verify1, #verify2').prop('disabled', false);
    }

    function disableVerify() {
        $('#verify1, #verify2').prop('disabled', true);
    }

    function checkEnableVerify() {
        if ($('#manifest').hasClass('active')) {
            if ($('#keyServer').hasClass('active')) {
                if (manifestFile && manifestSignatureFile && packageFile1 &&
                    document.getElementById('hkpKey').value)
                    enableVerify();
            } else {
                if (manifestFile && manifestSignatureFile && packageFile1 && publicKeyInputFile)
                    enableVerify();
            }
        } else {    // Without manifest
            if ($('#keyServer').hasClass('active')) {
                if (signatureFile && packageFile2 &&
                    document.getElementById('hkpServer').value && document.getElementById('hkpKey').value)
                    enableVerify();
            } else {
                if (signatureFile && packageFile2 && publicKeyInputFile)
                    enableVerify();
            }
        }
    }

    function checkFileType(fileContent, expectedType) {
        // Try to alert the user in case the work file was selected.
        // Only possible in case of PGP armored files.
        if (expectedType === "signature") {
            if (fileContent.startsWith('-----BEGIN PGP SIGNATURE-----') &&
                (fileContent.endsWith('-----END PGP SIGNATURE-----') ||
                    fileContent.endsWith('-----END PGP SIGNATURE-----\n')))
                return true
        } else if (expectedType === "publickey") {
            if (fileContent.startsWith('-----BEGIN PGP PUBLIC KEY BLOCK-----') &&
                (fileContent.endsWith('-----END PGP PUBLIC KEY BLOCK-----') ||
                    fileContent.endsWith('-----END PGP PUBLIC KEY BLOCK-----\n')))
                return true
        } else if (expectedType === "manifest") {
            let myManifest = /^[0-9a-fA-F]{40,128}\s/;
            let myRegex = myManifest.exec(fileContent);
            if (myRegex)
                return true
        }
        return false
    }

    function progressiveRead(file, destination, packageFileName) {
        console.log(file);
        let chunkSize = 2048000000;
        let pos = 0;
        let reader = new FileReader();

        function progressiveReadNext() {
            let end = Math.min(pos + chunkSize, file.size);

            reader.onload = function() {
                let data = reader.result;
                let array = new Int8Array(data);
                let myUint8 = new Uint8Array(data); // Used by signatures without manifest
                pos = end;
                if (pos < file.size) {
                    // Reading is not finished yet.
                    setTimeout(progressiveReadNext, 10);
                } else {
                    // Done reading. Let's process the content.
                    // I wanted to display digest info, so I chose SHA-256 as default
                    let displayAlgo = manifestAlgo || "SHA-256";
                    digestMessage(array, displayAlgo).then(digestValue => {
                        // Prepare variables
                        let packageDigest = hexString(digestValue);
                        // Firefox, Safari and others do not support file.lastModifiedDate anymore (deprecated)
                        const fileDate = new Date(file.lastModified);
                        let txtLoaded =
                            '<b>Filename: </b>' +
                            file.name +
                            '<br>' +
                            '<b>File size: </b>' +
                            humanFileSize(file.size, 1024) +
                            '<br>' +
                            '<b>Last modified: </b>' +
                            fileDate;
                        let txtDigest = '<br>' +
                            '<b>' + displayAlgo + ' digest: </b>' +
                            packageDigest;

                        let dec = new TextDecoder("utf-8");
                        let Uint8Arr = new Uint8Array(array);
                        let decoded = dec.decode(Uint8Arr);
                        if (file.size < 15000) {
                            console.log(decoded)
                        }

                        switch (destination) {
                            case 'manifestFile':
                                manifestFile = decoded;
                                if (checkFileType(manifestFile, "manifest")) {
                                    if (identifyDigest(manifestFile)) {
                                        console.log('Found manifest file ' + file.name + ' with algo ' + manifestAlgo);
                                        txtLoaded = txtLoaded +
                                            '<br>' +
                                            '<b>Found digest: </b>' +
                                            manifestAlgo;
                                        showAlert(txtLoaded, "alert-info", "Loaded manifest file");
                                    }
                                } else {
                                    console.log('Loaded ' + file.name + ' as manifest file (?)');
                                    showAlert(txtLoaded, "alert-warning", "Loaded manifest file (?)");
                                }
                                break;
                            case 'manifestSignatureFile':
                                manifestSignatureFile = decoded;
                                if (checkFileType(manifestSignatureFile, "signature")) {
                                    let op = window.openpgp;
                                    let signature = op.signature.readArmored(manifestSignatureFile).then(function(res) {
                                        console.log('Found signature file ' + file.name +
                                            ' signed by key ID ' + res.packets[0].issuerKeyId.toHex());
                                        txtLoaded = txtLoaded +
                                            '<br>' +
                                            '<b>Signed by key ID: </b>' +
                                            res.packets[0].issuerKeyId.toHex();
                                        showAlert(txtLoaded, "alert-info", "Loaded signature file");
                                        if (document.getElementById("hkpKey").value === "") {
                                            document.getElementById("hkpKey").value = res.packets[0].issuerKeyId.toHex();
                                        }
                                    });
                                } else {
                                    console.log('Loaded ' + file.name + ' as signature file (?)');
                                    showAlert(txtLoaded, "alert-warning", "Loaded signature file (?)");
                                }
                                break;
                            case 'publicKeyFile':
                                publicKeyInputFile = decoded;
                                if (checkFileType(publicKeyInputFile, "publickey")) {
                                    let op = window.openpgp;
                                    let pkey = op.key.readArmored(publicKeyInputFile).then(function(res) {
                                        let found_keys = '';
                                        let comma = '';
                                        for (let k in res.keys) {
                                            if (k > 0)
                                                comma = ', ';
                                            found_keys = found_keys + comma + 'key ID ' + res.keys[k].primaryKey.keyid.toHex();
                                            for (let s in res.keys[k].subKeys) {
                                                try {
                                                    found_keys = found_keys + ', subKey ID ' +
                                                        res.keys[k].subKeys[s].bindingSignatures[0].embeddedSignature.issuerKeyId.toHex();
                                                } catch (e) {
                                                }
                                            }
                                        }
                                        console.log('Found public key file ' + file.name + ' containing ' + found_keys +
                                            ' for informed user ' + res.keys[0].users[0].userId.userid);
                                        txtLoaded = txtLoaded +
                                            '<br>' +
                                            '<b>Found Keys: </b>' +
                                            found_keys +
                                            '<br>' +
                                            '<b>Informed user: </b>' +
                                            res.keys[0].users[0].userId.name +
                                            ' (' + res.keys[0].users[0].userId.email + ')';
                                        showAlert(txtLoaded, "alert-info", "Loaded public key");
                                    });
                                } else {
                                    console.log('Loaded ' + file.name + ' as public key file (?)');
                                    showAlert(txtLoaded, "alert-warning", "Loaded public key (?)");
                                }
                                break;
                            case 'packageFile1':
                                packageFile1 = decoded;
                                console.log('Loaded package file ' + file.name);
                                showAlert(txtLoaded + txtDigest,
                                    "alert-info", "Loaded package");
                                break;
                            case 'packageFile2':
                                packageFile2 = myUint8;
                                console.log('Loaded package file ' + file.name);
                                showAlert(txtLoaded + txtDigest,
                                    "alert-info", "Loaded package");
                                break;
                            case 'signatureFile':
                                signatureFile = decoded;
                                if (checkFileType(signatureFile, "signature")) {
                                    let op = window.openpgp;
                                    let signature = op.signature.readArmored(signatureFile).then(function(res) {
                                        console.log('Found signature file ' + file.name +
                                            ' signed by key ID ' + res.packets[0].issuerKeyId.toHex());
                                        txtLoaded = txtLoaded +
                                            '<br>' +
                                            '<b>Signed by key ID: </b>' +
                                            res.packets[0].issuerKeyId.toHex();
                                        showAlert(txtLoaded, "alert-info", "Loaded signature file");
                                        if (document.getElementById("hkpKey").value === "") {
                                            document.getElementById("hkpKey").value = res.packets[0].issuerKeyId.toHex();
                                        }
                                    });
                                } else {
                                    console.log('Loaded ' + file.name + ' as signature file (?)');
                                    showAlert(txtLoaded,
                                        "alert-warning", "Loaded signature file (?)");
                                }
                                break;
                            case 'compareFileMode':
                                // In this case do not convert to Uint8array
                                //array = packageFile1 before decoder
                                verifyDigest(manifestFile, array, packageFileName, manifestAlgo, manifestDigestSize);
                                break;
                        }
                        if (destination !== "compareFileMode")
                            checkEnableVerify();
                    });

                }
            };

            let blob;
            if (file.slice) {
                blob = file.slice(pos, end);
            } else if (file.webkitSlice) {
                blob = file.webkitSlice(pos, end);
            }
            reader.readAsArrayBuffer(blob);
        }
        setTimeout(progressiveReadNext, 10);
    }

    function checkTextDecoder() {
        if (!("TextDecoder" in window)) {
            console.log("Error: this browser does not support TextDecoder() from HTML5.");
            showAlert("This browser does not support TextDecoder() from HTML5.",
                'alert-danger', "Fail!");
        }
    }

    function checkMinimumCompat() {
        try {
            if (typeof FileReader == "undefined") return false;
            if (typeof Blob == "undefined") return false;
            let blob = new Blob();
            if (!blob.slice && !blob.webkitSlice) return false;
        } catch(e) {
            console.log("Error: this browser does not support HTML5.");
            showAlert("Could not proceed because this browser does not support HTML5.",
                'alert-danger', "Fail!");
            return false;
        }
        return true;
    }

    function printBanner() {
        let version = 0.1;
        console.log("DigiSign Oracle v" + version);
    }

    checkMinimumCompat();
    checkTextDecoder();
    disableVerify();
    loadTheme();
    printBanner();
});

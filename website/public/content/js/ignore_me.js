const scriptVersion = '1.0.2012a';
const scriptRelType = 'beta';
const scriptVerDate = '2/12/2018';
const allowInstalls = true;
const allowUpdates = true;
const allowRemoval = false;
const isDevMode = false; //devMode !== undefined && devMode === true;

var repoId = '';
var writableRepos = [];
var availableApps;
var availableDevs;
var currentManifest;
var selectedAppManifest;
var metricsData;
var retryCnt = 0;
var refreshCount;
var uCsrf;
var currentAppName;
var appManifests;

const authUrl = generateStUrl('hub');
const fetchReposUrl = generateStUrl('github/writeableRepos');
const updRepoUrl = generateStUrl('githubAuth/updateRepos');
const updFormUrl = generateStUrl('githubAuth/updateForm');
const doAppRepoUpdUrl = generateStUrl('ide/app/doRepoUpdates');
const doAppRemoveUrl = generateStUrl('ide/app/delete/');
const doDevRemoveUrl = generateStUrl('ide/device/delete/');
const doDevRepoUpdUrl = generateStUrl('ide/device/doRepoUpdates');
const doDevSettingUpdUrl = generateStUrl('ide/device/update');
const doAppSettingUpdUrl = generateStUrl('ide/app/update');

const appUpdChkUrl = generateStUrl('github/appRepoStatus?appId=');
const appUpdApplyUrl = generateStUrl('ide/app/updateOneFromRepo/');
const appUpdPubUrl = generateStUrl('ide/app/publishAjax/');
const devUpdChkUrl = generateStUrl('github/deviceRepoStatus?deviceTypeId=');
const devUpdApplyUrl = generateStUrl('ide/device/updateOneFromRepo/');
const devUpdPubUrl = generateStUrl('ide/device/publishAjax/');
const availableSaUrl = generateStUrl('api/smartapps/editable');
const availableDevsUrl = generateStUrl('ide/devices');

function generateStUrl(path) {
    return serverUrl + path;
}

function makeRequest(url, method, message, appId = null, appDesc = null, contentType = null, responseType = null, anyStatus = false) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        url += appId || '';
        xhr.onreadystatechange = function() {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    if (appId !== null && appDesc !== null) {
                        // console.log(xhr.response);
                        resolve({
                            response: xhr.response,
                            appId: appId,
                            appDesc: appDesc
                        });
                    } else {
                        resolve(xhr.response);
                    }
                } else if ((xhr.status === 500 || xhr.status === 302) && anyStatus === true) {
                    resolve(xhr.response);
                } else {
                    reject(Error(xhr.statusText));
                }
            }
        };
        xhr.onprogress = function() {
            // console.log('LOADING', xhr.readyState); // readyState will be 3
        };
        xhr.onerror = function() {
            if (appId !== null && appDesc !== null) {
                reject({
                    statusText: xhr.statusText,
                    appId: appId,
                    appDesc: appDesc
                });
            } else {
                reject(Error('XMLHttpRequest failed; error code:' + xhr.statusText));
            }
        };
        xhr.open(method, url, true);
        if (contentType !== null && responseType !== null) {
            xhr.setRequestHeader('Content-Type', contentType);
            xhr.responseType = responseType;
            if (message) {
                xhr.send(message);
            } else {
                xhr.send();
            }
        } else {
            xhr.send(message);
        }
    });
}

function getStAuth() {
    return new Promise(function(resolve, reject) {
        updLoaderText('Authenticating', 'Please Wait');
        makeRequest(authUrl, 'GET', null, null, null, 'text/html', '')
            .catch(function(err) {
                installError(err);
            })
            .then(function(resp) {
                if (resp !== undefined) {
                    getCsrf(resp);
                    $('#results').html('');
                    addResult('SmartThings Authentication', true);
                    resolve(true);
                }
                reject('Unauthorized');
            });
    });
}

function getCsrf(htmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr.toString(), 'text/html');
    var metas = doc.getElementsByTagName('meta');
    for (var i = 0; i < metas.length; i++) {
        const name = metas[i].getAttribute('name');
        if (name && name === '_csrf') {
            if (metas[i].getAttribute('content')) {
                uCsrf = metas[i].getAttribute('content');
            }
        }
    }
}

function capitalize(value) {
    var regex = /(\b[a-z](?!\s))/g;
    return value ?
        value.replace(regex, function(v) {
            return v.toUpperCase();
        }) :
        '';
}

function cleanString(str) {
    if (str) {
        return str === undefined ? '' : str.replace(/[^a-zA-Z0-9 ]/gi, ' ').replace(/\s{2,}/gi, ' ').trim();
    }
}

function cleanIdName(name) {
    return name.toString().replace(/[^a-zA-Z0-9 ]/gi, ' ').replace(/ /g, '_');
}

function addResult(str, good, type = '', str2 = '') {
    let s = '';
    if (['app', 'device', 'repo'].includes(type)) {
        s += '\n <li>';
        s += '\n     <div class="d-flex flex-row justify-content-between">';
        s += '\n         <div class="d-flex align-items-start flex-column">';
        s += '\n             <p class="mb-2"><span style="color: ' + (good !== false ? '#25c225' : '#FF0000') + ';"><i class="fa fa-' + (good !== false ? 'check' : 'exclamation') + '"></i></span> ' + str + ':</p>';
        s += '\n         </div>';
        s += '\n         <div class="d-flex align-items-end flex-column mt-1">';
        s += '\n             <span class="align-middle"><small><b><u>' + str2 + '</u></b></small></span>';
        s += '\n         </div>';
        s += '\n     </div>';
        s += '\n </li>';
    }
    switch (type) {
        case 'app':
            $('#appResultsTitle').css({ display: 'block' });
            $('#appResultUl').css({ display: 'block' }).append(s);
            break;
        case 'device':
            $('#devResultsTitle').css({ display: 'block' });
            $('#devResultUl').css({ display: 'block' }).append(s);
            break;
        case 'repo':
            $('#repoResultsTitle').css({ display: 'block' });
            $('#repoResultUl').css({ display: 'block' }).append(s);
            break;
        default:
            s = "<li><p><span style='color: " + (good !== false ? '#25c225' : '#FF0000') + ";'>";
            s += "<i class='fa fa-" + (good !== false ? 'check' : 'exclamation') + "'></i>";
            s += '</span> ' + str + '</p></li>';
            $('#ideResultsTitle').css({ display: 'block' });
            if (!checkListForDuplicate('#ideResultUl li', str)) {
                $('#ideResultUl').css({ display: 'block' }).append(s);
            }
            break;
    }
}

function checkListForDuplicate(element, str) {
    let items = [];
    $(element).each(function() {
        items.push($(this).text().trim());
    });
    return items.includes(str);
}

function installError(err, reload = true) {
    if (reload && parseInt(localStorage.getItem('refreshCount')) < 7) {
        setTimeout(loaderFunc, 1000);
    } else {
        if (err === 'Unauthorized') {
            installComplete(resultStrings.inst_comp_text.errors.auth_expired, true);
        } else {
            installComplete(resultStrings.inst_comp_text.errors.generic_error + err, true);
        }
    }
}

function installComplete(text, red = false, noResults = false) {
    $('#loaderDiv').css({ display: 'none' });
    $('#finishedImg').removeClass('fa-exclamation-circle').addClass('fa-check').css({ display: 'block' });
    if (red) {
        $('#finishedImg').removeClass('fa-check').addClass('fa-exclamation-circle').css({ color: 'red' });
    }
    $('#actResultsDiv').css({ display: 'block' });
    if (noResults) {
        $('#resultsContainer').css({ display: 'none' });
    }
    if (!red && !noResults) {
        $('#whatNextBtn').css({ display: 'block' });
    }
    $('#results').css({ display: 'block' }).html('<small>' + text + '</small>');
    $('#resultsDone').show();
    $('#resultsDoneHomeBtn').show();
    appCloseBtnAvail(false);
    updSectTitle('', true);
    defineClickActions();
    localStorage.removeItem('refreshCount');
    scrollToTop();
}

function updSectTitle(str, hide = false) {
    $('#sectTitle').html(str).css({ display: hide ? 'none' : 'block' });
    // $('#sectTitleHr').css({ display: hide ? 'none' : 'block' });
}

function updLoaderText(str1, str2) {
    $('#loaderText1').text(str1);
    $('#loaderText2').text(str2);
}

function buildRepoParamString(newRepo, existData) {
    let objs = [];
    objs.push('_csrf=' + uCsrf);
    objs.push('referringController=appIde');
    objs.push('referringAction=apps');
    // objs.push('defaultNamespace=' + repoData.namespace);
    objs.push('repos.id=0');
    objs.push('repos.owner=' + newRepo.repoOwner);
    objs.push('repos.name=' + newRepo.repoName);
    objs.push('repos.branch=' + newRepo.repoBranch);
    for (let i in existData) {
        objs.push('repos.id=' + existData[i].id);
        if (existData[i].owner !== undefined) {
            objs.push('repos.owner=' + existData[i].owner);
        }
        objs.push('repos.name=' + existData[i].name);
        objs.push('repos.branch=' + existData[i].branch);
    }
    return objs.join('&');
}

function buildInstallParams(repoid, items, type, method, publish = true) {
    let objs = [];
    objs.push('_csrf=' + uCsrf);
    objs.push('id=' + repoid);
    for (let i in items) {
        if (method === 'add') {
            objs.push('added=' + items[i].appUrl.toLowerCase());
        }
        if (method === 'update') {
            objs.push('updated=' + items[i].id);
        }
    }
    if (publish) {
        objs.push('publishUpdates=true');
    }
    objs.push('execute=Execute+Update');
    return objs.join('&');
}

function buildSettingParams(objData, item, repoId, repoData, objType) {
    let objs = [];
    objs.push('_csrf=' + uCsrf);
    objs.push('id=' + objData.id);
    if (repoId) {
        objs.push('gitRepo.id=' + repoId);
    }
    objs.push('name=' + objData.name);
    objs.push('author=' + objData.author);
    objs.push('namespace=' + repoData.namespace);
    objs.push('description=' + repoData.description);
    objs.push('iconUrl=' + objData.iconUrl);
    objs.push('iconX2Url=' + objData.iconX2Url);
    objs.push('iconX3Url=' + objData.iconX3Url);
    if (objType === 'app') {
        if (item.oAuth === true) {
            objs.push('oauthEnabled=true');
            objs.push('webServerRedirectUri=');
            objs.push('displayName=');
            objs.push('displayLink=');
        }
        if (item.appSettings.length) {
            for (const as in item.appSettings) {
                objs.push('smartAppSettings.name=' + as);
                objs.push('smartAppSettings.value=' + item.appSettings[as]);
            }
        }
        objs.push('photoUrls=');
        objs.push('videoUrls.0.videoUrl=');
        objs.push('videoUrls.0.thumbnailUrl=');
        objs.push('update=Update');
    }
    if (objType === 'device') {
        objs.push('_action_update=Update');
    }
    return objs.join('&');
}

function processIntall(repoData, selctd) {
    var allAppItems = [];
    allAppItems.push(repoData.smartApps.parent);
    for (const ca in repoData.smartApps.children) {
        if (selctd.smartapps.includes(repoData.smartApps.children[ca].name)) {
            allAppItems.push(repoData.smartApps.children[ca]);
        }
    }
    retryCnt++;
    getStAuth().then(function(resp) {
        if (resp === true) {
            checkIdeForRepo(repoData.repoName, repoData.repoBranch)
                .catch(function(err) {
                    installError(err, false);
                })
                .then(function(resp) {
                    // console.log(resp);
                    if (resp === false) {
                        addRepoToIde(repoData)
                            .catch(function(err) {
                                installError(err, false);
                            })
                            .then(function(resp) {
                                // console.log(resp);
                                checkIdeForRepo(repoData.repoName, repoData.repoBranch, true)
                                    .catch(function(err) {
                                        installError(err, false);
                                    })
                                    .then(function(resp) {
                                        //   console.log(resp);
                                        if (resp === true && repoData) {
                                            processIntall(repoData, selctd);
                                        }
                                    });
                            });
                    } else {
                        let appItems = allAppItems;
                        // console.log('appItems: ', appItems);
                        checkIfItemsInstalled(appItems, 'app')
                            .catch(function(err) {
                                installError(err, false);
                            })
                            .then(function(resp) {
                                // console.log('checkIfItemsInstalled: ', resp);
                                if (Object.keys(resp).length) {
                                    installAppsToIde(resp)
                                        .catch(function(err) {
                                            installError(err, false);
                                        })
                                        .then(function(resp) {
                                            // console.log('installAppsToIde: ', resp);
                                            if (resp === true) {
                                                checkIfItemsInstalled(appItems, 'app', true)
                                                    .catch(function(err) {
                                                        installError(err, false);
                                                    })
                                                    .then(function(resp) {
                                                        updateAppSettings(repoData)
                                                            .catch(function(err) {
                                                                installError(err, false);
                                                            })
                                                            .then(function(resp) {
                                                                if (resp && repoData.deviceHandlers && repoData.deviceHandlers.length) {
                                                                    let devItems = [];
                                                                    for (const dh in repoData.deviceHandlers) {
                                                                        if (selctd.devices.includes(repoData.deviceHandlers[dh].name)) {
                                                                            devItems.push(repoData.deviceHandlers[dh]);
                                                                        }
                                                                    }
                                                                    checkIfItemsInstalled(devItems, 'device')
                                                                        .catch(function(err) {
                                                                            installError(err, false);
                                                                        })
                                                                        .then(function(resp) {
                                                                            if (Object.keys(resp).length) {
                                                                                installDevsToIde(resp)
                                                                                    .catch(function(err) {
                                                                                        installError(err, false);
                                                                                    })
                                                                                    .then(function(resp) {
                                                                                        // console.log('installDevsToIde: ', resp);
                                                                                        if (resp === true) {
                                                                                            checkIfItemsInstalled(devItems, 'device', true)
                                                                                                .catch(function(err) {
                                                                                                    installError(err, false);
                                                                                                })
                                                                                                .then(function(resp) {
                                                                                                    if (Object.keys(resp).length) {
                                                                                                        if (Object.keys(repoData.deviceHandlers).length) {
                                                                                                            installComplete(resultStrings.inst_comp_text.general.install_complete);
                                                                                                        }
                                                                                                    } else {
                                                                                                        installComplete(resultStrings.inst_comp_text.general.install_complete);
                                                                                                    }
                                                                                                });
                                                                                        }
                                                                                    });
                                                                            } else {
                                                                                installComplete(resultStrings.inst_comp_text.general.install_complete);
                                                                            }
                                                                        });
                                                                } else {
                                                                    installComplete(resultStrings.inst_comp_text.general.install_complete);
                                                                }
                                                            });
                                                    });
                                            }
                                        });
                                } else if (repoData.deviceHandlers && repoData.deviceHandlers.length) {
                                    let devItems = [];
                                    for (const dh in repoData.deviceHandlers) {
                                        if (selctd.devices.includes(repoData.deviceHandlers[dh].name)) {
                                            devItems.push(repoData.deviceHandlers[dh]);
                                        }
                                    }
                                    checkIfItemsInstalled(devItems, 'device')
                                        .catch(function(err) {
                                            installError(err, false);
                                        })
                                        .then(function(resp) {
                                            if (Object.keys(resp).length) {
                                                installDevsToIde(resp)
                                                    .catch(function(err) {
                                                        installError(err, false);
                                                    })
                                                    .then(function(resp) {
                                                        // console.log('installDevsToIde: ', resp);
                                                        if (resp === true) {
                                                            checkIfItemsInstalled(devItems, 'device', true)
                                                                .catch(function(err) {
                                                                    installError(err, false);
                                                                })
                                                                .then(function(resp) {
                                                                    if (Object.keys(resp).length) {
                                                                        if (Object.keys(repoData.deviceHandlers).length) {
                                                                            installComplete(resultStrings.inst_comp_text.general.install_complete);
                                                                        }
                                                                    } else {
                                                                        installComplete(resultStrings.inst_comp_text.general.install_complete);
                                                                    }
                                                                });
                                                        }
                                                    });
                                            } else {
                                                installComplete(resultStrings.inst_comp_text.general.install_complete);
                                            }
                                        });
                                } else {
                                    installComplete(resultStrings.inst_comp_text.general.install_complete);
                                }
                            });
                    }
                });
        } else {
            if (retryCnt < 5) {
                processIntall(repoData, selctd);
            } else {
                installComplete(resultStrings.inst_comp_text.errors.auth_issue, true);
            }
        }
    });
}

function addRepoToIde(repoData) {
    return new Promise(function(resolve, reject) {
        updLoaderText('Adding', 'Repo to ST');
        let repoParams = buildRepoParamString(repoData, writableRepos);
        // console.log('repoParams: ', repoParams);
        addResult('Repo (' + repoData.repoName + ')', true, 'repo', 'Not Added');
        makeRequest(updRepoUrl, 'POST', repoParams, null, null, 'application/x-www-form-urlencoded', '', true)
            .catch(function(err) {
                installError(err, false);
                addResult('Github Repo Issue', false, 'repo', err);
                installComplete(resultStrings.inst_comp_text.errors.add_repo_error + err, true);
                reject(err);
            })
            .then(function(resp) {
                // console.log(resp);
                updLoaderText('Verifying', 'Repo');
                checkIdeForRepo(repoData.repoName, repoData.repoBranch)
                    .catch(function(err) {
                        installError(err, false);
                        reject(err);
                    })
                    .then(function(resp) {
                        if (resp === true) {
                            addResult('Repo (' + repoData.repoName + ')', true, 'repo', 'Added');
                            addResult('Repo (' + repoData.repoName + ')', true, 'repo', 'Verified');
                        }
                        resolve(resp);
                    });
                resolve(false);
            });
    });
}

function checkItemUpdateStatus(objId, type) {
    return new Promise(function(resolve, reject) {
        let url = type === 'device' ? devUpdChkUrl : appUpdChkUrl;
        makeRequest(url + objId, 'GET', null)
            .catch(function(err) {
                reject(err);
            })
            .then(function(resp) {
                // console.log(resp);
                let data = JSON.parse(resp);
                if (data.hasDifference === true) {
                    resolve(true);
                }
                resolve(false);
            });
    });
}

function getRepoId(repoName, repoBranch) {
    return new Promise(function(resolve, reject) {
        makeRequest(fetchReposUrl, 'GET', null)
            .catch(function(err) {
                // console.log(err);
                resolve(undefined);
            })
            .then(function(resp) {
                // console.log(resp);
                let respData = JSON.parse(resp);
                if (respData.length) {
                    writableRepos = respData;
                    for (let i in respData) {
                        if (respData[i].name === repoName && respData[i].branch === repoBranch) {
                            repoId = respData[i].id;
                            resolve(repoId);
                        }
                    }
                }
                resolve(undefined);
            });
    });
}

function checkIdeForRepo(rname, branch, secondPass = false) {
    return new Promise(function(resolve, reject) {
        let repoFound = false;
        updLoaderText('Checking', 'Repos');
        makeRequest(fetchReposUrl, 'GET', null)
            .catch(function(err) {
                installError(err, false);
                addResult('Checking Repo (' + rname + ')', false, 'repo', err);
                reject(err);
            })
            .then(function(resp) {
                // console.log(resp);
                updLoaderText('Analyzing', 'Repos');
                let respData = JSON.parse(resp);
                writableRepos = respData;
                if (respData.length) {
                    for (let i in respData) {
                        // console.log(respData[i]);
                        if (respData[i].name === rname && respData[i].branch === branch) {
                            if (!secondPass) {
                                addResult('Repo (' + rname + ')', true, 'repo', 'Already Added');
                            }
                            repoId = respData[i].id;
                            repoFound = true;
                        }
                    }
                }
                resolve(repoFound);
            });
    });
}

function installAppsToIde(apps, actType = 'install') {
    return new Promise(function(resolve, reject) {
        updLoaderText('Beginning', actType === 'update' ? 'Updates' : 'Installs');
        // console.log('repoParams: ', repoParams);
        if (apps) {
            updLoaderText(actType === 'update' ? 'Updating' : 'Installing', 'SmartApps');
            let pubApps = apps.filter(app => app.published === true);
            let noPubApps = apps.filter(app => app.published === false);
            let repoParams;
            var noPubPromise;
            var pubPromise = new Promise(function(resolve, reject) {
                if (pubApps.length > 0) {
                    repoParams = buildInstallParams(repoId, pubApps, 'apps', actType === 'update' ? 'update' : 'add');
                    makeRequest(doAppRepoUpdUrl, 'POST', repoParams, null, null, 'application/x-www-form-urlencoded', '', true)
                        .catch(function(err) {
                            installError(err, false);
                            addResult(actType === 'update' ? 'Updating' : 'Installing' + ' IDE Apps', false, 'app', err);
                            installComplete('App ' + capitalize(actType) + ' Error:<br/><br/>' + err, true);
                            reject(err);
                        })
                        .then(function(resp) {
                            updLoaderText('Apps', actType === 'update' ? 'Updated' : 'Installed');
                            for (let i in pubApps) {
                                addResult(pubApps[i].name.trim(), true, 'app', actType === 'update' ? 'Updated (+Pub)' : 'Installed (+Pub)');
                            }
                            resolve(true);
                        });
                } else {
                    resolve(true);
                }
            });
            Promise.all([pubPromise]).then(values => {
                var noPubPromise = new Promise(function(resolve, reject) {
                    if (noPubApps.length > 0) {
                        repoParams = buildInstallParams(repoId, noPubApps, 'apps', actType === 'update' ? 'update' : 'add', false);
                        makeRequest(doAppRepoUpdUrl, 'POST', repoParams, null, null, 'application/x-www-form-urlencoded', '', true)
                            .catch(function(err) {
                                installError(err, false);
                                addResult(actType === 'update' ? 'Updating' : 'Installing' + ' IDE Apps', false, 'app', err);
                                installComplete('App ' + capitalize(actType) + ' Error:<br/><br/>' + err, true);
                                reject(err);
                            })
                            .then(function(resp) {
                                updLoaderText('Apps', actType === 'update' ? 'Updated' : 'Installed');
                                for (let i in noPubApps) {
                                    addResult(noPubApps[i].name.trim(), true, 'app', actType === 'update' ? 'Updated (+Pub)' : 'Installed (+Pub)');
                                }
                                resolve(true);
                            });
                    } else {
                        resolve(true);
                    }
                });
                Promise.all([noPubPromise]).then(values => {
                    resolve(true);
                });
            });
        } else {
            addResult('Nothing to ' + actType === 'update' ? 'Update' : 'Install', false, 'app', 'No Apps Received');
            resolve(true);
        }
    });
}

function updateIdeItems(updData) {
    if (updData) {
        var appUpdProm = new Promise(function(resolve, reject) {
            if (updData.apps && updData.apps.length > 0) {
                updLoaderText('SmartApp', 'Updates');
                installAppsToIde(updData.apps, 'update')
                    .catch(function(err) {
                        // console.log(err);
                    })
                    .then(function(resp) {
                        resolve(true);
                    });
            } else {
                resolve(true);
            }
        });

        var devUpdProm = new Promise(function(resolve, reject) {
            if (updData.devs && updData.devs.length > 0) {
                updLoaderText('Device', 'Updates');
                updateDeviceFromRepo(updData.devs)
                    .catch(function(err) {
                        // console.log(err);
                    })
                    .then(function(resp) {
                        resolve(true);
                    });
            } else {
                resolve(true);
            }
        });
        Promise.all([appUpdProm, devUpdProm]).then(values => {
            installComplete(resultStrings.inst_comp_text.general.update_complete);
        });
    }
}

function updateDeviceFromRepo(devices) {
    return new Promise(function(resolve, reject) {
        updLoaderText('Beginning', 'Updates');
        // console.log('repoParams: ', repoParams);
        if (devices) {
            updLoaderText('Updating', 'Devices');
            let repoParams = buildInstallParams(repoId, devices, 'devices', 'update');
            makeRequest(doDevRepoUpdUrl, 'POST', repoParams, null, null, 'application/x-www-form-urlencoded', '', true)
                .catch(function(err) {
                    installError(err, false);
                    addResult('Device Update Issue', false, 'device', err);
                    installComplete(resultStrings.inst_comp_text.errors.device_update_error + err, true);
                    reject(err);
                })
                .then(function(resp) {
                    updLoaderText('Devices', 'Updated');
                    for (let i in devices) {
                        addResult(devices[i].name.trim(), true, 'device', 'Updated');
                    }
                    resolve(true);
                });
        }
    });
}

function removeAppsFromIde(appNames, selctd) {
    return new Promise(function(resolve, reject) {
        var allAppItems = [];
        for (const ca in appNames.smartApps.children) {
            if (selctd.smartapps.includes(appNames.smartApps.children[ca].name)) {
                allAppItems.push(appNames.smartApps.children[ca]);
            }
        }
        if (selctd.smartapps.includes(appNames.smartApps.parent.name)) {
            allAppItems.push(appNames.smartApps.parent);
        }
        var allDevItems = [];
        for (const dh in appNames.deviceHandlers) {
            if (selctd.devices.includes(appNames.deviceHandlers[dh].name)) {
                allDevItems.push(appNames.deviceHandlers[dh]);
            }
        }
        updLoaderText('Beginning', 'Removal');
        // console.log('repoParams: ', repoParams);
        if (allAppItems) {
            for (const da in availableApps) {
                for (const i in allAppItems) {
                    if (availableApps[da].name === allAppItems[i].name) {
                        makeRequest(doAppRemoveUrl + availableApps[da].id, 'GET', null)
                            .catch(function(err) {
                                installError(err, false);
                                addResult('App Removal Issue', false, 'app', err);
                                installComplete(resultStrings.inst_comp_text.errors.app_removal_error + err, true);
                                reject(err);
                            })
                            .then(function(resp) {
                                updLoaderText('Apps', 'Removed');
                                addResult(allAppItems[i].name, true, 'app', 'App Removed');
                                installComplete(resultStrings.inst_comp_text.general.app_removal_complete);
                            });
                    }
                }
            }
        }

        if (allDevItems) {
            for (const i in allDevItems) {
                for (const da in availableDevs) {
                    if (availableDevs[da].name.trim() === allDevItems[i].name.trim()) {
                        makeRequest(doDevRemoveUrl + availableDevs[da].id, 'GET', null)
                            .catch(function(err) {
                                installError(err, false);
                                addResult('Device Removal Issue', false, 'device', err);
                                installComplete(resultStrings.inst_comp_text.errors.app_removal_error + err, true);
                                reject(err);
                            })
                            .then(function(resp) {
                                updLoaderText('Devices', 'Removed');
                                addResult(allDevItems[i].name, true, 'device', 'Device Removed');
                                installComplete(resultStrings.inst_comp_text.general.app_removal_complete);
                            });
                    }
                }
            }
        } else {
            installComplete(resultStrings.inst_comp_text.general.app_dev_removal_complete);
        }
    });
}

function updateAppSettings(repoData) {
    return new Promise(function(resolve, reject) {
        updLoaderText('Modifying', 'Settings');
        var allAppItems = [];
        allAppItems.push(repoData.smartApps.parent);
        for (const ca in repoData.smartApps.children) {
            allAppItems.push(repoData.smartApps.children[ca]);
        }
        let updApps = allAppItems.filter(app => app.oAuth === true);
        if (updApps.length) {
            for (const i in updApps) {
                let appList = availableApps.filter(app => app.name === updApps[i].name);
                if (appList.length) {
                    for (const al in appList) {
                        let appParams = buildSettingParams(appList[al], updApps[i], repoId, repoData, 'app');
                        makeRequest(doAppSettingUpdUrl, 'POST', appParams, null, null, 'application/x-www-form-urlencoded', '', true)
                            .catch(function(err) {
                                installError(err, false);
                                addResult('App Settings Update', false, 'app', err);
                                installComplete(resultStrings.inst_comp_text.errors.app_setting_update_error + err, true);
                                reject(err);
                            })
                            .then(function(resp) {
                                // updLoaderText('Apps', 'Installed');
                                for (let i in updApps) {
                                    addResult(updApps[i].name, true, 'app', 'OAuth Enabled');
                                }
                                if (i < 1 ? 1 : i + 1 === updApps.length) {
                                    resolve(true);
                                }
                            });
                    }
                } else {
                    resolve(true);
                }
            }
        } else {
            resolve(true);
        }
    });
}

function installDevsToIde(devices) {
    return new Promise(function(resolve, reject) {
        updLoaderText('Beginning', 'Installs');
        // console.log('repoParams: ', repoParams);
        if (devices) {
            updLoaderText('Installing', 'Devices');
            let repoParams = buildInstallParams(repoId, devices, 'devices', 'add');
            makeRequest(doDevRepoUpdUrl, 'POST', repoParams, null, null, 'application/x-www-form-urlencoded', '', true)
                .catch(function(err) {
                    installError(err, false);
                    addResult('Install Devices Issue', false, 'device', err);
                    installComplete(resultStrings.inst_comp_text.errors.device_install_error + err, true);
                    reject(err);
                })
                .then(function(resp) {
                    updLoaderText('Devices', 'Installed');
                    for (let i in devices) {
                        addResult(devices[i].name.trim(), true, 'device', 'Installed');
                    }
                    resolve(true);
                });
        }
    });
}

function parseDomForDevices(domData) {
    const parser = new DOMParser();
    const respDoc = parser.parseFromString(domData.toString(), 'text/html');
    const appTable = respDoc.getElementById('devicetype-table');
    const theBody = appTable.getElementsByTagName('tbody');
    const theApps = theBody[0].getElementsByTagName('tr');
    const fndDTH = [];
    for (var i = 0; i < theApps.length; i++) {
        let devName = theApps[i].getElementsByClassName('namespace-name')[0].getElementsByTagName('a')[0].innerText.replace(/\n/g, '').trim().split(':');
        // let gitHubArr = theApps[i].getElementsByTagName('td')[2].innerHTML.replace(/<script[^>]*>(?:(?!<\/script>)[^])*<\/script>/g, '').replace(/\n/g, '').trim();
        fndDTH.push({
            id: theApps[i].id,
            name: (devName.length > 1 ? devName[1] : devName).toString().trim(),
            namespace: devName.length > 1 ? devName[0].toString().trim() : undefined,
            published: theApps[i].getElementsByTagName('td')[3].innerText.replace(/\n/g, '').trim() === 'Published'
                // capabilities: theApps[i].getElementsByTagName('td')[4].innerText.replace(/\n/g, '').trim(),
                // oAuth: theApps[i].getElementsByTagName('td')[5].innerText.replace(/\n/g, '').trim()
        });
    }
    // console.log(fndDTH);
    return fndDTH;
}

function getAvailableAppsDevices(updDom = false) {
    return new Promise(function(resolve, reject) {
        // console.log('apps:', apps);
        let out = {};
        if (updDom) {
            updLoaderText('Loading Data', 'Please Wait');
        }
        makeRequest(availableSaUrl, 'GET', null)
            .catch(function(err) {
                reject(err);
            })
            .then(function(resp) {
                // console.log(resp);
                let fndApps = JSON.parse(resp);
                if (fndApps.length) {
                    availableApps = fndApps;
                    out['apps'] = fndApps;
                }
                makeRequest(availableDevsUrl, 'GET', null)
                    .catch(function(err) {
                        reject(err);
                    })
                    .then(function(resp) {
                        // console.log(resp);
                        let fndDevs = parseDomForDevices(resp);
                        if (fndDevs.length) {
                            availableDevs = fndDevs;
                            out['devices'] = fndDevs;
                        }
                        resolve(out);
                    });
            });
    });
}

function checkIfItemsInstalled(itemObj, type, secondPass = false) {
    return new Promise(function(resolve, reject) {
        let url = type === 'device' ? availableDevsUrl : availableSaUrl;
        // console.log('apps:', apps);
        updLoaderText('Getting', capitalize(type) + ' Data');
        makeRequest(url, 'GET', null)
            .catch(function(err) {
                installError(err, false);
                addResult('Getting ' + capitalize(type) + 's Issue', false, type, err);
                reject(err);
            })
            .then(function(resp) {
                // console.log(resp);
                let itemsFnd;
                if (resp.length) {
                    if (type === 'device') {
                        itemsFnd = parseDomForDevices(resp);
                        availableDevs = itemsFnd;
                    } else {
                        itemsFnd = JSON.parse(resp);
                        availableApps = itemsFnd;
                    }
                    updLoaderText('Analyzing', capitalize(type));
                    for (let a in itemObj) {
                        for (let i in itemsFnd) {
                            if (itemsFnd[i].name === itemObj[a].name) {
                                if (!secondPass) {
                                    addResult(itemObj[a].name, true, type, 'Already Installed');
                                }
                                delete itemObj[a];
                                break;
                            }
                        }
                    }
                }
                resolve(itemObj);
            });
    });
}

function getProjectManifest(url) {
    return new Promise(function(resolve, reject) {
        updLoaderText('Getting', 'Manifest');
        makeRequest(url + '?=' + getTimeStamp(), 'GET', null)
            .catch(function(err) {
                installError(err, false);
                reject(err);
            })
            .then(function(resp) {
                // console.log(resp);
                if (resp !== undefined) {
                    let mani = JSON.parse(resp);
                    if (mani.name !== undefined) {
                        resolve(mani);
                    } else {
                        reject(undefined);
                    }
                } else {
                    reject(undefined);
                }
            });
    });
}

function getTimeStamp() {
    var d = new Date();
    return d.getTime();
}

function getAppManifests() {
    return new Promise(function(resolve, reject) {
        updLoaderText('Getting', 'App Manifest');
        makeRequest(baseAppUrl + '/content/configs/secret_sauce.json?=' + getTimeStamp(), 'GET', null)
            .catch(function(err) {
                reject(err);
            })
            .then(function(resp) {
                // console.log(resp);
                if (resp !== undefined) {
                    let mani = JSON.parse(resp);
                    if (mani.apps && mani.apps.length > 0) {
                        appManifests = mani.apps;
                        resolve(mani.apps);
                    } else {
                        reject(undefined);
                    }
                } else {
                    reject(undefined);
                }
            });
    });
}

function incrementAppView(appName) {
    var fb = new Firebase('https://community-installer-34dac.firebaseio.com/metrics/appViews/' + appName);
    fb.transaction(function(currentVal) {
        isFinite(currentVal) || (currentVal = 0);
        return currentVal + 1;
    });
}

function incrementAppInstall(appName) {
    var fb = new Firebase('https://community-installer-34dac.firebaseio.com/metrics/appInstalls/' + appName);
    fb.transaction(function(currentVal) {
        isFinite(currentVal) || (currentVal = 0);
        return currentVal + 1;
    });
}

function incrementLikeDislike(appName, type) {
    var fb = new Firebase('https://community-installer-34dac.firebaseio.com/metrics/appRatings/' + appName + '/' + hashedUuid);
    fb.transaction(function(currentVal) {
        isFinite(currentVal) || (currentVal = 0);
        return (currentVal = type === 'dislike' ? 0 : 1);
    });
}

function findAppMatch(srchStr, data) {
    if (srchStr === undefined) {
        return data.sort(dynamicSort('name'));
    }
    if (srchStr.length >= 3) {
        return data.filter(appItem => JSON.stringify(appItem).toString().toLowerCase().includes(srchStr.toLowerCase())).sort(dynamicSort('name'));
    } else {
        return data.sort(dynamicSort('name'));
    }
}

function dynamicSort(property) {
    var sortOrder = 1;
    if (property[0] === '-') {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function(a, b) {
        var result = a[property] < b[property] ? -1 : a[property] > b[property] ? 1 : 0;
        return result * sortOrder;
    };
}

function searchForApp(evtSender) {
    let srchVal = $('#appSearchBox').val();
    // console.log('AppSearch Event (' + evtSender + '): ' + srchVal);
    if (evtSender === 'clear') {
        srchVal = '';
    }
    buildAppList(srchVal);
}

function startMetricsListener() {
    var fb = new Firebase('https://community-installer-34dac.firebaseio.com/metrics/');
    fb.on('value', function(snap) {
        var v = snap.val();
        // console.log('v: ', v);
        metricsData = v;
        updateMetricsData();
    });
}

function updateMetricsData() {
    let v = metricsData;
    if (v !== undefined && v !== null && Object.keys(v).length) {
        if (v.appInstalls && Object.keys(v.appInstalls).length) {
            for (const i in v.appInstalls) {
                var iItem = $('#' + i + '_install_cnt');
                let cnt = parseInt(v.appInstalls[i]);
                if (cnt >= 0) {
                    iItem.removeClass('grey').addClass('orange').text(cnt);
                }
            }
        }
        if (v.appViews && Object.keys(v.appViews).length) {
            for (const i in v.appViews) {
                var vItem = $('#' + i + '_view_cnt');
                if (vItem.length) {
                    let cnt = parseInt(v.appViews[i]);
                    if (cnt >= 0) {
                        vItem.removeClass('grey').addClass('purple').text(cnt);
                    }
                }
            }
        }
        if (v.appRatings && Object.keys(v.appRatings).length) {
            for (const i in v.appRatings) {
                let dislikeCnt = 0;
                let likeCnt = 0;
                var dItem = $('#' + i + '_dislike_cnt');
                var lItem = $('#' + i + '_like_cnt');
                if (dItem.length && Object.keys(v.appRatings[i]).length) {
                    let cnts = Object.values(v.appRatings[i]);
                    for (const c in cnts) {
                        if (parseInt(cnts[c]) === 1) {
                            likeCnt++;
                        }
                        if (parseInt(cnts[c]) === 0) {
                            dislikeCnt++;
                        }
                    }
                }
                dItem.html('<i class="fa fa-thumbs-down fa-sm red-text"></i> ' + dislikeCnt);
                lItem.html('<i class="fa fa-thumbs-up fa-sm green-text"></i> ' + likeCnt);
            }
        }
    }
}

function getIsAppOrDeviceInstalled(itemName, type, manData) {
    let res = {};
    if (itemName && type) {
        let data = type === 'app' ? availableApps : availableDevs;
        let clnName = cleanString(itemName);
        let clnIdName = cleanIdName(itemName);
        let instApp = data.filter(item =>
            item.name.toString() === itemName.toString() ||
            item.name.toString() === clnName.toString() ||
            cleanString(item.name).toString() === clnName.toString() ||
            item.name.toString().toLowerCase() === itemName.toString().toLowerCase() ||
            cleanIdName(item.name.toString()) === clnIdName.toString() ||
            cleanIdName(item.name.toString()).toString().toLowerCase() === clnIdName.toString().toLowerCase());
        let appFnd;
        if (instApp.length > 0 && type === 'device') {
            appFnd = instApp.filter(item => item.namespace === undefined || item.namespace.toString() === manData.namespace.toString());
        } else {
            appFnd = instApp;
        }
        res['installed'] = appFnd[0] !== undefined && appFnd.length > 0;
        res['data'] = appFnd;
    } else {
        res['installed'] = false;
        res['data'] = [];
    }
    return res;
}

function installBtnAvail(cnt, data) {
    let itemCnt = data.smartApps.children.length + data.deviceHandlers.length;
    // console.log(itemCnt);
    if (itemCnt + 1 === cnt) {
        $('#installBtn').addClass('disabled');
    } else {
        $('#installBtn').removeClass('disabled');
    }
}

function processItemsStatuses(data, viewType) {
    if (viewType === 'appList') {
        if (data.length > 0) {
            for (let i in data) {
                let mData = { published: true, namespace: data.namespace, author: data.author };
                if (updateAppDeviceItemStatus(data[i].appName, 'app', viewType, undefined, mData) === true) {
                    // cnt++;
                    // installBtnAvail(cnt, data);
                }
            }
        }
    } else {
        if (data && data.smartApps) {
            let cnt = 1;
            if (data.smartApps.parent) {
                let mData = { published: true, namespace: data.namespace, author: data.author };
                if (updateAppDeviceItemStatus(data.smartApps.parent.name, 'app', viewType, data.smartApps.parent.appUrl, mData) === true) {
                    cnt++;
                    installBtnAvail(cnt, data);
                }
            }

            if (data.smartApps.children.length) {
                for (const sa in data.smartApps.children) {
                    let mData = { published: data.smartApps.children[sa].published !== false, namespace: data.namespace, author: data.author };
                    if (updateAppDeviceItemStatus(data.smartApps.children[sa].name, 'app', viewType, data.smartApps.children[sa].appUrl, mData) === true) {
                        cnt++;
                        installBtnAvail(cnt, data);
                    }
                }
            }
        }
        if (data && data.deviceHandlers.length) {
            for (const dh in data.deviceHandlers) {
                let mData = { published: true, namespace: data.namespace, author: data.author };
                if (updateAppDeviceItemStatus(data.deviceHandlers[dh].name, 'device', viewType, data.deviceHandlers[dh].appUrl, mData) === true) {
                    cnt++;
                    installBtnAvail(cnt, data);
                }
            }
        }
    }
}

function updateAppDeviceItemStatus(itemName, type, viewType, appUrl, manData) {
    if (itemName) {
        let installedItem = getIsAppOrDeviceInstalled(itemName, type, manData);
        let appInstalled = installedItem.installed === true;
        let statusElementName = cleanIdName(itemName) + '_appview_status_' + type;
        if (installedItem && installedItem.data && installedItem.data[0] !== undefined) {
            if (viewType === 'appList') {
                statusElementName = itemName;
            }
            checkItemUpdateStatus(installedItem.data[0].id, type)
                .catch(function(err) {
                    // console.log(err);
                })
                .then(function(resp) {
                    updateAvail = resp === true;
                    if (appInstalled || updateAvail) {
                        let itemStatus;
                        let color;
                        if (updateAvail) {
                            itemStatus = 'Updates';
                            color = viewType === 'appList' ? 'ribbon-orange' : 'orange';
                            $('#updateBtn').show();
                        } else {
                            itemStatus = 'Installed';
                            color = viewType === 'appList' ? 'ribbon-blue' : 'blue';
                        }
                        if (viewType === 'appList') {
                            updateAppListStatusRibbon(statusElementName, itemStatus, color);
                            if (appInstalled) {
                                $('#' + itemName).data('installed', true);
                                $('#' + itemName).data('details', {
                                    id: installedItem.data[0].id,
                                    type: type,
                                    name: installedItem.data[0].name,
                                    appUrl: appUrl
                                });
                            }
                        } else {
                            $('#' + statusElementName).text(itemStatus).addClass(color);
                            if (updateAvail) {
                                $('#' + statusElementName).data('hasUpdate', true);
                            }
                            if (appInstalled) {
                                $('#' + statusElementName).data('installed', true);
                                $('#' + statusElementName).data('published', manData.published);
                                $('#' + statusElementName).data('details', {
                                    id: installedItem.data[0].id,
                                    type: type,
                                    name: installedItem.data[0].name,
                                    appUrl: appUrl,
                                    published: manData.published,
                                    namespace: manData.namespace,
                                    author: manData.author
                                });
                            }
                        }
                    }
                });
        } else {
            if (viewType === 'appView') {
                $('#' + statusElementName).text('Not Installed');
            }
        }
    }
}

function updateAppListStatusRibbon(itemName, status, color = undefined) {
    if (itemName && status) {
        let ribbon = $('#' + itemName + '_ribbon');
        let ribbonStatus = $('#' + itemName + '_ribbon_status');
        $(ribbon).css({ display: 'block' });
        if (color) {
            $(ribbonStatus).addClass(color);
        }
        $(ribbonStatus).text(status);
    }
}

function buildAppList(filterStr = undefined) {
    searchBtnAvail(true);
    let html = '';
    let appData = findAppMatch(filterStr, appManifests);
    currentManifest = appData;
    html += '\n           <div id="searchFormDiv" class="d-flex flex-row justify-content-center align-items-center" style="display: none;">';
    html += '\n               <div class="d-flex w-100 flex-column m-2">';
    html += '\n                <form id="searchForm"  style="display: none;">';
    html += '\n                   <div class="input-group md-form form-sm form-2 mb-0">';
    html += '\n                       <input id="appSearchBox" class="form-control grey-border white-text" type="text" placeholder="Search" aria-label="Search">';
    html += '\n                       <span class="input-group-addon waves-effect grey lighten-3" id="searchBtn"><a><i class="fa fa-search text-grey" aria-hidden="true"></i></a></span>';
    html += '\n                   </div>';
    html += '\n                </form>';
    html += '\n               </div>';
    html += '\n           </div>';
    if (appData.length > 0) {
        html += '\n<div id=listDiv class="clearfix">';
        html += '\n   <div class="listGroup">';
        html += '\n       <div class="p-2 mb-0" style="background-color: transparent;">';
        html += '\n           <table id="appListTable" class="table table-sm mb-0">';
        html += '\n               <tbody>';

        for (let i in appData) {
            html += '\n   <tr style="border-bottom-style: hidden; border-top-style: hidden;">';
            html += '\n   <td class="py-1">';
            html += '\n     <a href="#" id="' + appData[i].appName + '" class="list-group-item list-group-item-action flex-column align-items-start p-2" style="border-radius: 20px;">';

            html += '\n         <div id="' + appData[i].appName + '_ribbon" class="ribbon" style="display: none;"><span id="' + appData[i].appName + '_ribbon_status"> </span></div>';

            html += '\n         <!-- APP NAME SECTION TOP (START)-->';
            html += '\n         <div class="d-flex w-100 justify-content-between align-items-center">';
            html += '\n             <div class="d-flex flex-column justify-content-center align-items-center">';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <div class="d-flex justify-content-start align-items-center">';
            html += '\n                         <h6 class="h6-responsive"><img src="' + appData[i].iconUrl + '" height="40" class="d-inline-block align-middle" alt=""> ' + appData[i].name + '</h6>';
            html += '\n                     </div>';
            html += '\n                 </div>';
            html += '\n             </div>';

            html += '\n         </div>';
            html += '\n         <!-- APP NAME SECTION TOP (END)-->';

            html += '\n         <!-- APP DESCRIPTION SECTION (START)-->';
            html += '\n         <div class="d-flex justify-content-start align-items-center mt-1 mb-3" style="border-style: inset; border: 1px solid grey; border-radius: 5px;">';
            html += '\n             <p class="d-flex m-2 justify-content-center"><small class="align-middle">' + appData[i].description + '</small></p>';
            html += '\n         </div>';
            html += '\n         <!-- APP DESCRIPTION SECTION (END)-->';

            html += '\n         <!-- APP METRICS SECTION (START)-->';
            html += '\n         <div class="d-flex w-100 justify-content-between align-items-center mb-3">';
            html += '\n             <div class="d-flex flex-column justify-content-center align-items-center">';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <small class="align-middle"><u><b>Views:</b></u></small>';
            html += '\n                 </div>';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <span id="' + appData[i].appName + '_view_cnt" class="badge badge-pill grey white-text align-middle">0</span>';
            html += '\n                 </div>';
            html += '\n             </div>';
            html += '\n             <div class="d-flex flex-column justify-content-center align-items-center">';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <small class="align-middle"><u><b>Ratings:</b></u></small>';
            html += '\n                 </div>';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <div class="mx-2"><small><span id="' + appData[i].appName + '_like_cnt" class="black-text"><i class="fa fa-thumbs-up fa-sm green-text"></i> 0</span></small></div>';
            html += '\n                     <div class="mx-2"><small><span id="' + appData[i].appName + '_dislike_cnt" class="black-text"><i class="fa fa-thumbs-down fa-sm red-text"></i> 0</span></small></div>';
            html += '\n                 </div>';
            html += '\n             </div>';
            html += '\n             <div class="d-flex flex-column justify-content-center align-items-center">';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <small class="align-middle"><u><b>Installs:</b></u></small>';
            html += '\n                 </div>';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <span id="' + appData[i].appName + '_install_cnt" class="badge badge-pill grey white-text align-middle">0</span>';
            html += '\n                 </div>';
            html += '\n             </div>';
            html += '\n         </div>';
            html += '\n         <!-- APP METRICS SECTION (END)-->';

            html += '\n         <!-- APP STATUS SECTION TOP (START)-->';
            html += '\n         <div class="d-flex w-100 justify-content-between align-items-center">';
            html += '\n             <div class="d-flex flex-column justify-content-center align-items-center">';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <small class="align-middle"><u><b>Author:</b></u></small>';
            html += '\n                 </div>';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <small class="align-middle" style="font-size: 12px;"><em>' + appData[i].author + '</em></small>';
            html += '\n                 </div>';
            html += '\n             </div>';

            html += '\n             <div class="d-flex flex-column justify-content-center align-items-center">';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <small class="align-middle"><u><b>Category:</b></u></small>';
            html += '\n                 </div>';
            html += '\n                 <div class="d-flex flex-row">';
            html += '\n                     <small class="align-middle"><em>' + appData[i].category + '</em></small>';
            html += '\n                 </div>';
            html += '\n             </div>';
            html += '\n         </div>';
            html += '\n         <!-- APP STATUS SECTION TOP (END)-->';
            html += '\n     </a>';
            html += '\n   </td>';
            html += '\n   </tr>';
        }
        html += '\n            </table>';
        html += '\n         </tbody>';
        html += '\n      </div>';
        html += '\n   </div>';
        html += '\n</div>';
    } else {
        html += '\n  <h6>No Items Found</h6>';
        html += '\n  <button id="clearSearchBtn" type="button" class="btn btn-md btn-outline-secondary mx-2" style="background: transparent;border: 2px solid white; color: white !important;"><span><i class="fa fa-times white-text"></i> Clear Search</span></button>';
    }
    scrollToTop();
    updSectTitle('Select an Item');
    $('#listContDiv').html('').html(html);
    searchBtnAvail(true);
    $('#loaderDiv').css({ display: 'none' });
    $('#actResultsDiv').css({ display: 'none' });
    $('#appViewDiv').css({ display: 'none' });
    $('#appSearchBox').keypress(function(e) {
        if (e.which === 13) {
            searchForApp('KeyPress');
            return false;
        }
    });
    $('#searchBtn').click(function() {
        searchForApp('Clicked');
    });
    $('#showSearchBtn').click(function() {
        searchFormToggle();
    });
    $('#clearSearchBtn').click(function() {
        searchForApp('clear');
    });
    $('#appListTable').on('click', 'td a', function() {
        // console.log('App Item Clicked: (' + this.id + ')');
        if (this.id) {
            renderAppView(this.id);
        }
    });
    $('#listContDiv').css({ display: 'block' });
    updateMetricsData();
    processItemsStatuses(appData, 'appList');
    new WOW().init();
}

function searchFormToggle() {
    // console.log('showSearchBtn clicked...');
    if ($('#searchForm').is(':visible')) {
        $('#searchForm').hide();
        $('#searchFormDiv').hide();
    } else {
        $('#searchForm').show();
        $('#searchFormDiv').show();
    }
}

function searchBtnAvail(show = true) {
    if (show) {
        $('#showSearchBtn').show();
    } else {
        $('#showSearchBtn').hide();
    }
}

function appCloseBtnAvail(show = true) {
    if (show) {
        $('#appCloseBtn').show();
    } else {
        $('#appCloseBtn').hide();
    }
}

function homeBtnAvail(show = true) {
    if (show) {
        $('#homeNavBtn').show();
    } else {
        $('#homeNavBtn').hide();
    }
}

function createAppDevTable(items, areDevices = false, type) {
    let html = '';
    if (items.length) {
        // html += '\n   <div class="col-xs-12 ' + (areDevices ? 'col-md-6' : 'col-sm-12') + ' mb-2 p-0">';
        html += '\n   <div class="col mb-2 p-0">';
        html += '\n       <h6 class="h6-responsive white-text"><u>' + (type === 'app' ? 'SmartApps' : 'Devices') + '</u></h6>';
        html += '\n       <div class="d-flex justify-content-center">';
        html += '\n           <div class="d-flex w-100 justify-content-center align-items-center mx-4">';
        html += '\n               <table class="table table-sm table-bordered">';
        html += '\n                   <thead>';
        html += '\n                       <tr>';
        html += '\n                           <th style="border: 1px solid grey;"><div class="text-center"><small class="align-middle">Name:</small></div></th>';
        html += '\n                           <th style="border: 1px solid grey;"><div class="text-center"><small class="align-middle">Version:</small></div></th>';
        html += '\n                           <th style="border: 1px solid grey;"><div class="text-center"><small class="align-middle">IDE Options:</small></div></th>';
        html += '\n                       </tr>';
        html += '\n                   </thead>';
        html += '\n                   <tbody>';

        let cnt = 0;
        for (const item in items) {
            var appPub = type === 'device' || items[item].published === true;
            var appOauth = items[item].oAuth === true;
            var appOptional = items[item].optional !== false;
            var parent = items[item].isParent === true;
            var child = items[item].isChild === true;
            var disabled = parent || !appOptional ? ' disabled' : '';
            var checked = parent || !appOptional ? ' checked' : '';
            var itemId = type === 'device' ? 'device' + cnt : 'smartapp' + cnt;
            html += '\n                       <tr>';
            html += '\n                           <td class="align-middle py-0" style="border: 1px solid grey;">';
            html += '\n                               <div class="d-flex flex-column ml-2">';
            html += '\n                                   <div class="d-flex flex-column justify-content-start my-1 form-check' + disabled + '">';
            html += '\n                                       <div class="flex-column justify-content-start">';
            html += '\n                                           <div class="d-flex flex-row">';
            html += '\n                                               <input class="form-check-input align-middle" type="checkbox" value="" id="' + itemId + '"' + checked + disabled + '>';
            html += '\n                                               <label class="form-check-label align-middle" for="' + itemId + '"><small id="' + itemId + 'name" class="align-middle" style="font-size: 0.7em; white-space: nowrap;">' + items[item].name + '</small></label>';
            html += '\n                                           </div>';
            html += '\n                                       </div>';
            html += '\n                                   </div>';
            html += '\n                               </div>';
            html += '\n                           </td>';
            html += '\n                           <td class="align-middle" style="border: 1px solid grey;">';
            html += '\n                               <div class="d-flex flex-column align-items-center">';
            html += '\n                                   <small class="align-middle" style="margin: 2px auto;"><span class="badge grey white-text align-middle">v' + items[item].version + '</span></small>';
            html += '\n                                   <small class="align-middle" style="margin: 2px auto;"><span id="' + cleanIdName(items[item].name) + '_appview_status_' + type + '" class="badge white-text align-middle"></span></small>';
            html += '\n                               </div>';
            html += '\n                           </td>';
            html += '\n                           <td class="align-middle py-0" style="border: 1px solid grey;">';
            html += '\n                               <div class="d-flex flex-column align-items-center">';
            html += parent === true ? '\n                 <small style="margin: 2px auto;"><span class="badge blue white-text">Parent App</span></small>' : '';
            html += child === true ? '\n                  <small style="margin: 2px auto;"><span class="badge purple white-text">Child App</span></small>' : '';
            html += appPub === true ? '\n                 <small style="margin: 2px auto;"><span class="badge green white-text">Publishing</span></small>' : '';
            html += appOauth === true ? '\n               <small style="margin: 2px auto;"><span class="badge orange white-text">Enable OAuth</span></small>' : '';
            html += '\n                               </div>';
            html += '\n                           </td>';
            html += '\n                      </tr>';
            cnt++;
        }
        html += '\n                </tbody>';
        html += '\n            </table>';
        html += '\n       </div>';
        html += '\n   </div>';
        html += '\n</div>';
    }
    return html;
}

function renderAppView(appName) {
    let html = '';
    var manifest;
    if (appManifests.length > 0) {
        let appItem = appManifests.filter(app => app.appName === appName);
        let appInpt = $('#' + appName);
        let isInstalled = appInpt.length > 0 && appInpt.data('installed') !== undefined && appInpt.data('installed') === true;
        // console.log(appItem);
        for (let i in appItem) {
            getProjectManifest(appItem[0].manifestUrl)
                .catch(function(err) {
                    $('#actResultsDiv').css({ display: 'block' });
                    installComplete(resultStrings.inst_comp_text.errors.smartapp_manifest_error + ' (' + appName + ')<br/><br/>' + err, true, true);
                })
                .then(function(resp) {
                    // console.log(resp);
                    manifest = resp;
                    // console.log('manifest: ', manifest);
                    if (manifest !== undefined && Object.keys(manifest).length) {
                        if (!isDevMode === true) { incrementAppView(appName); }
                        appCloseBtnAvail(true);
                        $('#appNameListItem').text('Tap On (' + appName + ')');
                        html += '\n    <div id="appViewCard" class="p-0 mb-0" style="background-color: transparent;">';
                        updSectTitle('', true);
                        let cnt = 1;
                        html += '\n     <!--App Description Panel-->';
                        html += '\n     <div class="card card-body card-outline p-1 mb-2" style="background-color: transparent;">';
                        // html += '\n        <div class="flex-row align-right mr-1 mt-1">';
                        // html += '\n           <button type="button" id="appCloseBtn" class="close white-text" aria-label="Close">';
                        // html += '\n               <span aria-hidden="true">&times;</span>';
                        // html += '\n           </button>';
                        // html += '\n       </div>';
                        html += '\n       <div class="flex-row align-center mt-0 mb-1">';
                        if (manifest.bannerUrl && manifest.bannerUrl.length > 0 && manifest.bannerUrl !== '') {
                            html += '\n           <img class="align-center" src="' + manifest.bannerUrl + '" style="height: auto; max-height: 75px;">';
                        } else {
                            html += '\n           <img class="align-center" src="' + manifest.smartApps.parent.iconUrl + '" style="height: auto; max-height: 75px;">';
                        }
                        html += '\n       </div>';
                        html += '\n       <div class="flex-row align-center m-3">';
                        html += '\n           <small class="white-text"><b>Author:</b> ' + manifest.author + '</small>';
                        html += '\n           <div class="flex-column align-items-center">';
                        html += '\n               <div class="d-flex w-100 justify-content-center align-items-center">';
                        html += '\n                   <p class="card-text">' + manifest.description + '</p>';
                        html += '\n               </div>';
                        html += '\n           </div>';
                        html += '\n       </div>';
                        html += '\n     </div>';
                        html += '\n     <!--/.App Description Panel-->';
                        if (manifest.forumUrl || manifest.docUrl) {
                            html += '\n     <!--Community Description Panel-->';
                            html += '\n     <div class="card card-body card-outline px-1 py-3 mb-2" style="background-color: transparent;">';
                            html += '\n         <div class="d-flex justify-content-center align-items-center mx-auto">';
                            html += '\n             <div class="d-flex flex-column justify-content-center align-items-center mx-2">';
                            html += '\n                 <div class="btn-group" role="group" aria-label="Basic example">';
                            if (manifest.forumUrl) {
                                html += '\n                 <div class="d-flex flex-row">';
                                html += '\n                     <a class="btn btn-sm mx-2" href="' + manifest.forumUrl + '"><small-medium class="orange-text">Project Link</small-medium></a>';
                                html += '\n                 </div>';
                            }
                            if (manifest.docUrl) {
                                html += '\n                 <div class="d-flex flex-row">';
                                html += '\n                     <a class="btn btn-sm mx-2" href="' + manifest.docUrl + '"><small-medium class="orange-text">Documentation</small-medium></a>';
                                html += '\n                 </div>';
                            }
                            html += '\n                 </div>';
                            html += '\n             </div>';
                            html += '\n         </div>';
                            html += '\n     </div>';
                            html += '\n     <!--/.Community Description Panel-->';
                        }
                        if (manifest.repoName && manifest.repoBranch && manifest.repoOwner) {
                            html += '\n     <!--Repo Description Panel-->';
                            html += '\n     <div class="card card-body card-outline px-1 py-0 mb-2" style="background-color: transparent;">';

                            html += '\n           <!--Accordion wrapper-->';
                            html += '\n           <div class="accordion" id="repoAccordionEx" role="tablist" aria-multiselectable="true">';

                            html += '\n               <!-- Accordion card -->';
                            html += '\n               <div class="card mb-0" style="background-color: transparent; border-bottom: none;">';

                            html += '\n                   <!-- Card header -->';
                            html += '\n                   <div class="card-header my-0" role="tab" id="repoCardCollapseHeading">';
                            html += '\n                       <a data-toggle="collapse" data-parent="#repoAccordionEx" href="#repoCardCollapse" aria-expanded="true" aria-controls="repoCardCollapse">';
                            html += '\n                           <h6 class="white-text mb-0"><u>GitHub Details</u> <i class="fa fa-angle-down rotate-icon"></i></h6>';
                            html += '\n                       </a>';
                            html += '\n                   </div>';

                            html += '\n                   <!-- Card body -->';
                            html += '\n                   <div id="repoCardCollapse" class="collapse" role="tabpanel" aria-labelledby="repoCardCollapseHeading">';
                            html += '\n                       <div class="card-body white-text py-0">';
                            html += '\n                         <div class="d-flex justify-content-center align-items-center mx-auto mb-2">';
                            html += '\n                             <div class="d-flex flex-column justify-content-center align-items-center mx-2">';
                            html += '\n                                 <div class="d-flex flex-row">';
                            html += '\n                                     <small class="align-middle"><b>Repo Name</b></small>';
                            html += '\n                                 </div>';
                            html += '\n                                 <div class="d-flex flex-row">';
                            html += '\n                                     <small class="align-middle mx-2"><em>' + manifest.repoName + '</em></small>';
                            html += '\n                                 </div>';
                            html += '\n                             </div>';
                            html += '\n                             <div class="d-flex flex-column justify-content-center align-items-center mx-2">';
                            html += '\n                                 <div class="d-flex flex-row">';
                            html += '\n                                     <small class="align-middle"><b>Branch</b></small>';
                            html += '\n                                 </div>';
                            html += '\n                                 <div class="d-flex flex-row">';
                            html += '\n                                     <small class="align-middle mx-2"><em>' + manifest.repoBranch + '</em></small>';
                            html += '\n                                 </div>';
                            html += '\n                             </div>';
                            html += '\n                             <div class="d-flex flex-column justify-content-center align-items-center mx-2">';
                            html += '\n                                 <div class="d-flex flex-row">';
                            html += '\n                                     <small class="align-middle"><b>Owner</b></small>';
                            html += '\n                                 </div>';
                            html += '\n                                 <div class="d-flex flex-row">';
                            html += '\n                                     <small class="align-middle mx-2"><em>' + manifest.repoOwner + '</em></small>';
                            html += '\n                                 </div>';
                            html += '\n                             </div>';
                            html += '\n                         </div>';
                            html += '\n                       </div>';
                            html += '\n                   </div>';
                            html += '\n               </div>';
                            html += '\n               <!-- Accordion card -->';
                            html += '\n           </div>';
                            html += '\n           <!--/.Accordion wrapper-->';

                            html += '\n     </div>';
                            html += '\n     <!--/.Repo Description Panel-->';
                        }
                        if (manifest.notes) {
                            html += '\n     <!--Notes Block Panel-->';
                            html += '\n     <div class="card card-body card-outline px-1 py-0 mb-2" style="background-color: transparent;">';

                            html += '\n           <!--Accordion wrapper-->';
                            html += '\n           <div class="accordion" id="notesAccordionEx" role="tablist" aria-multiselectable="true">';

                            html += '\n               <!-- Accordion card -->';
                            html += '\n               <div class="card mb-0" style="background-color: transparent; border-bottom: none;">';

                            html += '\n                   <!-- Card header -->';
                            html += '\n                   <div class="card-header my-0" role="tab" id="notesCardCollapseHeading">';
                            html += '\n                       <a data-toggle="collapse" data-parent="#notesAccordionEx" href="#notesCardCollapse" aria-expanded="false" aria-controls="notesCardCollapse">';
                            html += '\n                           <h6 class="white-text mb-0"><u>Notes</u> <i class="fa fa-angle-down rotate-icon"></i></h6>';
                            html += '\n                       </a>';
                            html += '\n                   </div>';

                            html += '\n                   <!-- Card body -->';
                            html += '\n                   <div id="notesCardCollapse" class="collapse show" role="tabpanel" aria-labelledby="notesCardCollapseHeading">';
                            html += '\n                       <div class="card-body white-text py-0">';
                            html += '\n                         <div class="d-flex justify-content-center align-items-center mx-auto mb-2">';
                            html += '\n                             <div class="d-flex flex-column justify-content-center align-items-center mx-2">';
                            html += '\n                                 <div>';
                            html += '\n                                     ' + manifest.notes;
                            html += '\n                                 </div>';
                            html += '\n                             </div>';
                            html += '\n                         </div>';
                            html += '\n                       </div>';
                            html += '\n                   </div>';
                            html += '\n               </div>';
                            html += '\n               <!-- Accordion card -->';
                            html += '\n           </div>';
                            html += '\n           <!--/.Accordion wrapper-->';

                            html += '\n     </div>';
                            html += '\n     <!--/.Notes Block Panel-->';
                        }

                        if (isInstalled) {
                            html += '\n     <!--Rating Block Panel-->';
                            html += '\n     <div class="card card-body card-outline px-1 py-0 mb-2" style="background-color: transparent;">';
                            html += '\n       <h6 class="h6-responsive white-text"><u>Rate the Software</u></h6>';
                            html += '\n       <div class="flex-row align-right mr-1 my-2">';
                            html += '\n           <div class="d-flex flex-column justify-content-center align-items-center">';
                            html += '\n               <div class="btn-group">';
                            html += '\n                   <button id="likeAppBtn" type="button" class="btn mx-2" style="background: transparent;"><span><i class="fa fa-thumbs-up green-text"></i></span></button>';
                            html += '\n                   <button id="dislikeAppBtn" type="button" class="btn mx-2" style="background: transparent;"><span><i class="fa fa-thumbs-down red-text"></i></span></button>';
                            html += '\n               </div>';
                            html += '\n           </div>';
                            html += '\n       </div>';

                            html += '\n     </div>';
                            html += '\n     <!--/.Ratings Block Panel-->';
                        }
                        html += '\n     <!--App Options Panel-->';
                        html += '\n     <div class="card card-body card-outline px-1 py-3 mb-2" style="background-color: transparent;">';
                        html += '\n         <div class="row">';
                        // Start Here

                        let apps = [];
                        manifest.smartApps.parent['isParent'] = true;
                        apps.push(manifest.smartApps.parent);
                        if (manifest.smartApps.children.length) {
                            for (const sa in manifest.smartApps.children) {
                                manifest.smartApps.children[sa]['isChild'] = true;
                                apps.push(manifest.smartApps.children[sa]);
                            }
                        }
                        html += createAppDevTable(apps, manifest.deviceHandlers.length, 'app');

                        let devs = [];
                        if (manifest.deviceHandlers.length) {
                            for (const dh in manifest.deviceHandlers) {
                                devs.push(manifest.deviceHandlers[dh]);
                            }
                        }
                        html += createAppDevTable(devs, true, 'device');
                        html += '\n      </div>';
                        html += '\n  </div>';
                        // Stop Here
                        html += '\n  <div class="p-1 my-2" style="background-color: transparent;">';
                        html += '\n       <div class="flex-row align-right mr-1 my-2">';
                        html += '\n           <div class="d-flex flex-column justify-content- align-items-center">';
                        html += '\n               <div class="btn-group">';
                        if (allowInstalls === true) {
                            html += '\n                   <button id="installBtn" type="button" class="btn btn-success mx-2 p-0" style="border-radius: 20px;height: 40px;width: 100px;"><span><i class="fa fa-plus white-text"></i> Install</span></button>';
                        }
                        if (allowRemoval === true) {
                            html += '\n                   <button id="removeBtn" type="button" class="btn btn-danger mx-2" style="border-radius: 20px;height: 30px;">Remove</button>';
                        }
                        if (allowUpdates === true) {
                            html += '\n                   <button id="updateBtn" type="button" class="btn btn-warning mx-2 p-0" style="border-radius: 20px;height: 40px;width: 100px; display: none;"><span><i class="fa fa-arrow-up white-text"></i> Update</span></button>';
                        }
                        html += '\n               </div>';
                        html += '\n           </div>';
                        html += '\n       </div>';
                        html += '\n  </div>';
                        html += '\n</div>';
                        html += '\n<div class="clearfix"></div>';
                    }
                    $('#appViewDiv').append(html);
                    // AppCloseButton Event
                    $('#appCloseBtn').click(function() {
                        // console.log('appCloseBtn');
                        updSectTitle('Select an Item');
                        $('#appViewDiv').html('');
                        $('#appViewDiv').css({ display: 'none' });
                        $('#listContDiv').css({ display: 'block' });
                        appCloseBtnAvail(false);
                        searchBtnAvail(true);
                    });
                    $('#dislikeAppBtn').click(function() {
                        incrementLikeDislike(appName, 'dislike');
                        $(this).addClass('disabled');
                        $('#likeAppBtn').removeClass('disabled');
                    });
                    $('#likeAppBtn').click(function() {
                        incrementLikeDislike(appName, 'like');
                        $(this).addClass('disabled');
                        $('#dislikeAppBtn').removeClass('disabled');
                    });
                    $('#installBtn').click(function() {
                        let selectedItems = getSelectedCodeItems();
                        // console.log('checked: ', selectedItems);
                        updSectTitle('Install Progress');
                        $('#appViewDiv').html('');
                        $('#appViewDiv').css({ display: 'none' });
                        $('#listContDiv').css({ display: 'none' });
                        $('#loaderDiv').css({ display: 'block' });
                        $('#actResultsDiv').css({ display: 'block' });
                        scrollToTop();
                        if (!isInstalled && !isDevMode === true) {
                            incrementAppInstall(appName);
                        }
                        processIntall(manifest, selectedItems);
                    });
                    $('#removeBtn').click(function() {
                        let selectedItems = getSelectedCodeItems();
                        updSectTitle('Removal Progress');
                        $('#appViewDiv').html('');
                        $('#appViewDiv').css({ display: 'none' });
                        $('#listContDiv').css({ display: 'none' });
                        $('#loaderDiv').css({ display: 'block' });
                        $('#actResultsDiv').css({ display: 'block' });
                        scrollToTop();
                        removeAppsFromIde(manifest, selectedItems);
                    });
                    $('#updateBtn').click(function() {
                        let devUpds = getUpdateItemsByType('device');
                        let appUpds = getUpdateItemsByType('app');
                        let updData = {};
                        updData['apps'] = appUpds;
                        updData['devs'] = devUpds;
                        updSectTitle('Update Progress');
                        $('#appViewDiv').html('');
                        $('#appViewDiv').css({ display: 'none' });
                        $('#listContDiv').css({ display: 'none' });
                        $('#loaderDiv').css({ display: 'block' });
                        $('#actResultsDiv').css({ display: 'block' });
                        homeBtnAvail(false);
                        scrollToTop();
                        getRepoId(manifest.repoName, manifest.repoBranch)
                            .catch(function(err) {
                                // console.log(err);
                            })
                            .then(function(resp) {
                                updateIdeItems(updData);
                            });
                    });
                    $('#listContDiv').css({ display: 'none' });
                    $('#loaderDiv').css({ display: 'none' });
                    $('#actResultsDiv').css({ display: 'none' });
                    $('#appViewDiv').css({ display: 'block' });
                    searchBtnAvail(false);
                    scrollToTop();
                    processItemsStatuses(manifest, 'appView');
                    new WOW().init();
                });
        }
    }
}

function areAllItemsInstalled(manifest) {
    let appsInst = getInstalledItemsByType('app');
    // console.log(getInstalledItemsByType('app'));
    let devsInst = getInstalledItemsByType('device');
    // console.log(getInstalledItemsByType('device'));
    if (Object.keys(manifest).length > 0) {
        if (appsInst.filter(app => app.name === manifest.smartApps.parent.name).length >= 1) {
            delete manifest.smartApps['parent'];
        }
        if (manifest.smartApps.children.length) {
            for (const sa in manifest.smartApps.children) {
                if (appsInst.filter(app => app.name === manifest.smartApps.children[sa].name).length >= 1) {
                    delete manifest.smartApps.children[sa];
                }
            }
        }
        if (manifest.deviceHandlers.length) {
            for (const dh in manifest.deviceHandlers) {
                if (devsInst.filter(dev => dev.name === manifest.deviceHandlers[dh].name).length >= 1) {
                    delete manifest.deviceHandlers[dh];
                }
            }
        }
    }
    if (manifest.smartApps.parent === undefined && manifest.smartApps.children.length < 1 && manifest.deviceHandlers.length < 1) {
        return true;
    } else {
        return false;
    }
}

function getInstalledItemsByType(type) {
    if (type) {
        let results = [];
        let items = $('span')
            .filter(function() {
                return $(this).data('installed') === true && $(this).data('details').type === type;
            })
            .each(function() {
                // console.log($(this).data('details'));
                results.push($(this).data('details'));
            });
        return results;
    }
    return undefined;
}

function getUpdateItemsByType(type) {
    if (type) {
        let results = [];
        let items = $('span')
            .filter(function() {
                return $(this).data('hasUpdate') === true && $(this).data('details').type === type;
            })
            .each(function() {
                results.push($(this).data('details'));
            });
        return results;
    }
    return undefined;
}

function getSelectedCodeItems() {
    var selected = {};
    selected['smartapps'] = [];
    selected['devices'] = [];
    $('#appViewCard input:checked').each(function() {
        let itemName = $(this).attr('id');
        if (itemName.startsWith('smartapp')) {
            selected['smartapps'].push($('#' + $(this).attr('id') + 'name').text());
        }
        if (itemName.startsWith('device')) {
            selected['devices'].push($('#' + $(this).attr('id') + 'name').text());
        }
    });
    return selected;
}

function scrollToTop() {
    $(document).ready(function() {
        $(this).scrollTop(0);
    });
}

function defineClickActions() {
    $('#resultsDoneHomeBtn').click(function() {
        location.href = homeUrl;
    });
}

function loaderFunc() {
    if (localStorage.getItem('refreshCount') === null) {
        localStorage.setItem('refreshCount', '0');
    }
    localStorage.setItem('refreshCount', (parseInt(localStorage.getItem('refreshCount')) + 1).toString());
    scrollToTop();
    updSectTitle('App Details', true);
    getStAuth()
        .catch(function(err) {
            if (err === 'Unauthorized' && parseInt(localStorage.getItem('refreshCount')) > 6) {
                installComplete(resultStrings.inst_comp_text.errors.auth_expired, true);
            } else {
                installError(err, true);
            }
        })
        .then(function(resp) {
            if (resp === true) {
                getAppManifests()
                    .catch(function(err) {
                        installComplete(resultStrings.inst_comp_text.errors.app_list_manifest_error + err, true, true);
                    })
                    .then(function(manifestResp) {
                        getAvailableAppsDevices(true)
                            .catch(function(err) {
                                if (err === 'Unauthorized') {
                                    installComplete(resultStrings.inst_comp_text.errors.auth_expired, true);
                                }
                                installError(err, false);
                            })
                            .then(function(resp) {
                                scrollToTop();
                                if (resp && resp.apps && Object.keys(resp).length) {
                                    loadAppList();
                                }
                            });
                    });
            }
        });
}

function loadAppList() {
    if ((appManifests !== undefined && appManifests.length > 0) || (availableApps !== undefined && availableApps.length > 0)) {
        buildAppList();
        startMetricsListener();
    }
}

function buildCoreHtml() {
    let head = '';
    head += '\n                 <meta charset="utf-8">';
    head += '\n                 <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, user-scalable=0">';
    head += '\n                 <meta http-equiv="cleartype" content="on">';
    head += '\n                 <meta name="MobileOptimized" content="320">';
    head += '\n                 <meta name="HandheldFriendly" content="True">';
    head += '\n                 <meta name="apple-mobile-web-app-capable" content="yes">';
    head += '\n                 <link rel="shortcut icon" type="image/x-icon" href="' + baseAppUrl + '/content/images/app_logo.ico" />';
    head += '\n                 <title>Community Installer</title>';
    // head += '\n                 <link rel="stylesheet" type="text/css" href="' + baseAppUrl + '/content/css/main_mdb.min.css" />';
    // head += '\n                 <link rel="stylesheet" type="text/css" href="' + baseAppUrl + '/content/css/mdb.min.css" />';
    head += '\n                 <link rel="stylesheet" type="text/css" href="https://fonts.googleapis.com/css?family=Roboto" />';
    head += '\n                 <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/css/toastr.min.css" />';
    head += '\n                 <script src="https://use.fontawesome.com/a81eef09c0.js" async></script>';
    head += '\n                 <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous" async></script>';
    head += '\n                 <script src="https://cdnjs.cloudflare.com/ajax/libs/wow/1.1.2/wow.min.js" async></script>';
    head += '\n                 <script src="https://static.firebase.com/v0/firebase.js" async></script>';
    head += '\n                 <script src="https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/js/toastr.min.js" async></script>';
    // head += '\n                 <link rel="stylesheet" type="text/css" href="' + baseAppUrl + '/content/css/main_web.min.css" />';
    // head += '\n                 <!-- Global site tag (gtag.js) - Google Analytics --> <script async src="https://www.googletagmanager.com/gtag/js?id=UA-113463133-1"></script><script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag("js", new Date()); gtag("config", "UA-113463133-1");</script>';
    $('head').append(head);

    let html = '';
    html += '\n       <header>';
    html += '\n           <nav class="navbar navbar-fixed-top navbar-dark ">';
    html += '\n               <div class="d-flex w-100 justify-content-between align-items-center mx-auto" style="max-width: 725px;">';
    html += '\n                   <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                       <a id="homeNavBtn" class="nav-link white-text p-0" href="' + homeUrl + '" style="font-size: 30px;"><i id="homeBtn" class="fa fa-home"></i><span class="sr-only">(current)</span></a>';
    html += '\n                   </div>';
    html += '\n                   <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                       <a class="navbar-brand"><span class="align-middle"><img src="' + baseAppUrl + '/content/images/app_logo.png" height="40" class="d-inline-block align-middle" alt=""> Installer</span></a>';
    html += '\n                   </div>';
    html += '\n                   <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                       <a id="showSearchBtn" class="nav-link white-text p-0" style="font-size: 30px; display: none;"><i class="fa fa-search"></i><span class="sr-only">(current)</span></a>';
    html += '\n                       <button type="button" id="appCloseBtn" class="btn-md close white-text" aria-label="Close" style="display: none;"><span aria-hidden="true"><i class="fa fa-arrow-left white-text"></i></span></button>';
    html += '\n                   </div>';
    html += '\n               </div>';
    html += '\n           </nav>';
    html += '\n       </header>';
    html += '\n       <main class="mt-3">';
    html += '\n           <div id="mainDiv" class="container-fluid" style="min-width: 380px; max-width: 750px; height: auto; min-height: 100%;">';
    html += '\n               <section class="px-3">';
    html += '\n                   <div class="w-100 text-center">';
    html += '\n                       <h5 id="sectTitle" class="h5-responsive" style="font-weight: 400;">Software Installer</h5>';
    html += '\n                       <div id="loaderDiv" class="flex-row fadeIn fadeOut">';
    html += '\n                           <div class="d-flex flex-column justify-content-center align-items-center" style="height: 200px;">';
    html += '\n                               <svg id="loader" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" class="lds-double-ring">';
    html += '\n                                   <circle cx="50" cy="50" ng-attr-r="{{config.radius}}" ng-attr-stroke-width="{{config.width}}" ng-attr-stroke="{{config.c1}}" ng-attr-stroke-dasharray="{{config.dasharray}}" fill="none" stroke-linecap="round" r="40" stroke-width="7" stroke="#18B9FF" stroke-dasharray="62.83185307179586 62.83185307179586" transform="rotate(139.357 50 50)">';
    html += '\n                                       <animateTransform attributeName="transform" type="rotate" calcMode="linear" values="0 50 50;360 50 50" keyTimes="0;1" dur="1.8s" begin="0s" repeatCount="indefinite"></animateTransform>';
    html += '\n                                   </circle>';
    html +=
        '\n                                   <circle cx="50" cy="50" ng-attr-r="{{config.radius2}}" ng-attr-stroke-width="{{config.width}}" ng-attr-stroke="{{config.c2}}" ng-attr-stroke-dasharray="{{config.dasharray2}}" ng-attr-stroke-dashoffset="{{config.dashoffset2}}" fill="none" stroke-linecap="round" r="32" stroke-width="7" stroke="#FF7F27" stroke-dasharray="50.26548245743669 50.26548245743669" stroke-dashoffset="50.26548245743669" transform="rotate(-139.357 50 50)">';
    html += '\n                                       <animateTransform attributeName="transform" type="rotate" calcMode="linear" values="0 50 50;-360 50 50" keyTimes="0;1" dur="1.8s" begin="0s" repeatCount="indefinite"></animateTransform>';
    html += '\n                                   </circle>';
    html += '\n                                   <text id="loaderText1" fill="gray" stroke-width="0" x="50%" y="50%" text-anchor="middle" class="loaderText">Please</text>';
    html += '\n                                   <text id="loaderText2" fill="gray" stroke-width="0" x="50%" y="60%" text-anchor="middle" class="loaderText">Wait</text>';
    html += '\n                               </svg>';
    html += '\n                           </div>';
    html += '\n                       </div>';
    html += '\n                       <div id="listContDiv" class="row fadeIn fadeOut" style="display: none;"></div>';
    html += '\n                       <div id="appViewDiv" class="row fadeIn fadeOut" style="display: none;"></div>';

    html += '\n                       <div id="actResultsDiv" class="row fadeIn fadeOut mb-5" style="display: none;">';
    html += '\n                           <div class="listDiv">';
    html += '\n                               <div id="resultList">';
    html += '\n                                   <div class="card card-body card-outline" style="background-color: transparent; line-height:1.0;">';

    html += '\n                                       <div class="row">';
    html += '\n                                           <div class="d-flex w-100 flex-column mb-3">';
    html += '\n                                               <i id="finishedImg" class="fa fa-check" style="display: none;"></i>';
    html += '\n                                               <div id="results"></div>';
    html += '\n                                               <div id="resultsDone" class="mt-2" style="display: none;"><small>To Exit App Press Back/Save</small></div>';
    html += '\n                                               <div id="resultsContainer" class="d-flex flex-column justify-content-center mx-2">';
    html += '\n                                                   <div class="d-flex flex-column align-items-center" style="border: 1px solid gray; border-radius: 10px;">';

    html += '\n                                                       <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                                                           <h6 id="ideResultsTitle" class="mt-2 mb-0" style="display: none;"><u>IDE Authentication</u></h6>';
    html += '\n                                                           <ul id="ideResultUl" class="w-100 px-4" style="display: none;"></ul>';
    html += '\n                                                       </div>';

    html += '\n                                                       <div class="d-flex w-100 flex-column justify-content-center align-items-center">';
    html += '\n                                                           <h6 id="repoResultsTitle" class="mt-2 mb-0" style="display: none;"><u>GitHub Integration</u></h6>';
    html += '\n                                                           <ul id="repoResultUl" class="w-100 px-3" style="display: none;"></ul>';
    html += '\n                                                       </div>';

    html += '\n                                                       <div class="d-flex w-100 flex-column justify-content-center align-items-center">';
    html += '\n                                                            <h6 id="appResultsTitle" class="mt-2 mb-0" style="display: none;"><u>SmartApps</u></h6>';
    html += '\n                                                           <ul id="appResultUl" class="w-100 px-3" style="display: none; font-size: 0.9em;"></ul>';
    html += '\n                                                       </div>';

    html += '\n                                                       <div class="d-flex w-100 flex-column justify-content-center align-items-center">';
    html += '\n                                                           <h6 id="devResultsTitle" class="mt-2 mb-0" style="display: none;"><u>Devices</u></h6>';
    html += '\n                                                           <ul id="devResultUl" class="w-100 px-3" style="display: none; font-size: 0.9em;"></ul>';
    html += '\n                                                       </div>';

    html += '\n                                                   </div>';
    html += '\n                                               </div>';
    html += '\n                                               <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                                                 <div class="btn-group">';
    html += '\n                                                   <button id="resultsDoneHomeBtn" type="button" class="btn white-text mt-3 mx-2 px-2" style="display: none; border-radius: 20px; background: transparent; width: 130px;"><i id="homeBtn" class="fa fa-home"></i> Go Home</button>';
    html += '\n                                                   <button id="whatNextBtn" type="button" class="btn waves-effect waves-light mt-3 mx-2 px-2 blue" style="border-radius: 20px; display: none; width: 130px;" data-toggle="modal" data-target="#doneModal"><span class="white-text"><i class="fa fa-chevron-circle-right"></i> What Next?</span></button>';
    html += '\n                                                 </div>';
    html += '\n                                               </div>';
    html += '\n                                          </div>';

    html += '\n                                     </div>';
    html += '\n                                 </div>';
    html += '\n                            </div>';
    html += '\n                       </div>';
    html += '\n               </section>';

    html += '\n           </div>';
    html += '\n       </main>';
    html += '\n       <footer id="ftrSect" class="page-footer center-on-small-only m-0 p-0">';
    html += '\n           <div class="footer-copyright">';
    html += '\n               <div class="containter-fluid">';
    html += '\n                       <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                           <button class="btn btn-sm btn-outline-primary" data-toggle="modal" data-target="#aboutModal" style="background: transparent; border-color: white;"><span class="white-text"><i class="fa fa-info"></i> About</span></button>';
    html += '\n                           <small class="align-middle"><u>v' + scriptVersion + ' (' + scriptRelType + ')</u></small>';
    html += '\n                       </div>';
    html += '\n               </div>';
    html += '\n           </div>';
    html += '\n       </footer>';

    html += '\n       <!-- Modal -->';
    html += '\n       <div class="modal fade-in" id="doneModal" tabindex="-1" role="dialog" aria-labelledby="doneModalLabel" aria-hidden="true">';
    html += '\n           <div class="modal-dialog modal-dialog-centered" role="document">';
    html += '\n               <div class="modal-content darkModalBg">';
    html += '\n                   <!--  Modal BODY -->';
    html += '\n                   <div class="modal-body py-2">';
    html += '\n                       <div class="card card-body pt-3" style="background-color: transparent;">';
    html += '\n                           <div class="flex-row align-center">';
    html += '\n                               <div class="d-flex flex-row justify-content-center">';
    html += '\n                                   <div class="d-flex flex-column justify-content-center align-items-center text-center">';
    html += '\n                                       <h5><u>What Next?</u></h5>';
    html += '\n                                       <ol class="m-0 p-0 text-left">';
    html += '\n                                          <li style="font-size: 12px">Press Save All the way out of the app.</li>';
    html += '\n                                          <li style="font-size: 12px">Tap Marketplace</li>';
    html += '\n                                          <li style="font-size: 12px">Tap SmartApps Tab</li>';
    html += '\n                                          <li style="font-size: 12px">Tap My Apps</li>';
    html += '\n                                          <li style="font-size: 12px" id="appNameListItem"></li>';
    html += '\n                                          <li style="font-size: 12px">That\'s It!</li>';
    html += '\n                                       </ol>';
    html += '\n                                   </div>';
    html += '\n                               </div>';
    html += '\n                           </div>';
    html += '\n                       </div>';
    html += '\n                   </div>';
    html += '\n                   <!--  Modal FOOTER -->';
    html += '\n                   <div class="modal-body py-2">';
    html += '\n                       <div class="card card-body pt-3" style="background-color: transparent;">';
    html += '\n                           <button type="button" class="btn btn-sm btn-secondary mx-5 my-0" data-dismiss="modal">Close</button>';
    html += '\n                       </div>';
    html += '\n                   </div>';
    html += '\n               </div>';
    html += '\n           </div>';
    html += '\n       </div>';

    html += '\n       <!-- Modal -->';
    html += '\n       <div class="modal fade-in" id="aboutModal" tabindex="-1" role="dialog" aria-labelledby="aboutModalLabel" aria-hidden="true">';
    html += '\n           <div class="modal-dialog modal-dialog-centered" role="document">';
    html += '\n               <div class="modal-content darkModalBg">';
    html += '\n                   <!--  Modal BODY -->';
    html += '\n                   <div class="modal-body py-2">';
    html += '\n                       <div class="card card-body pt-3" style="background-color: transparent;">';
    html += '\n                           <div class="flex-row align-center">';
    html += '\n                               <div class="d-flex flex-row justify-content-center">';
    html += '\n                                   <h3 class="modal-title align-self-center" id="exampleModalLongTitle">Community Installer</h3>';
    html += '\n                               </div>';
    html += '\n                               <div class="flex-row justify-content-center mb-3">';
    html += '\n                                   <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                                       <small><u>Author:</u></small>';
    html += '\n                                       <small>Anthony Santilli (@tonesto7)</small>';
    html += '\n                                   </div>';
    html += '\n                                   <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                                       <small><u>Co-Author:</u></small>';
    html += '\n                                       <small>Corey Lista (@coreylista)</small>';
    html += '\n                                   </div>';
    html += '\n                               </div>';
    html += '\n                               <div class="flex-row justify-content-center">';
    html += '\n                                   <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                                       <small><u>SmartApp Version:</u></small>';
    html += '\n                                       <small>v' + appVersion + '</small>';
    html += '\n                                   </div>';
    html += '\n                                   <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                                       <small><u>WebApp Version:</u></small>';
    html += '\n                                       <small>v' + scriptVersion + ' (' + scriptRelType + ')</small>';
    html += '\n                                   </div>';
    html += '\n                               </div>';
    html += '\n                           </div>';
    html += '\n                       </div>';
    html += '\n                   </div>';
    html += '\n                   <div class="modal-body py-2">';
    html += '\n                       <div class="card card-body pt-3" style="background-color: transparent;">';
    html += '\n                           <div class="flex-row align-center">';
    html += '\n                               <div class="d-flex flex-row justify-content-center">';
    html += '\n                                   <div class="d-flex flex-column justify-content-center align-items-center text-center">';
    html += '\n                                       <h5><u>Notice</u></h5>';
    html += '\n                                       <small><strong>Use this product at your own risk!</strong></small>';
    html += '\n                                       <small>We are NOT responsible for any SmartApps and/or Devices displayed in this App.  They will always be the responsibility of the individual developer</small>';
    html += '\n                                       <small>We are NOT responsible for any damages obtained to yourself or your belonging while using this application</small>';
    html += '\n                                       <small>Now Please Enjoy It!!!</small>';
    html += '\n                                   </div>';
    html += '\n                               </div>';
    html += '\n                           </div>';
    html += '\n                       </div>';
    html += '\n                   </div>';
    html += '\n                   <!--  Modal FOOTER -->';
    html += '\n                   <div class="modal-body py-2">';
    html += '\n                       <div class="card card-body pt-3" style="background-color: transparent;">';
    html += '\n                           <div class="flex-row align-center">';
    html += '\n                               <div class="d-flex flex-row justify-content-center">';
    html += '\n                                   <div class="d-flex flex-column justify-content-center align-items-center">';
    html += '\n                                       <h6>Want to make a Donation?</h6>';
    html +=
        '\n                                       <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top"><input type="hidden" name="cmd" value="_s-xclick"><input type="hidden" name="hosted_button_id" value="VPPATVAXQLTNC"><input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"></form>';
    html += '\n                                       <small><u>Privacy</u></small>';
    html += '\n                                       <a class="blue-text" href="https://community-installer-34dac.firebaseapp.com/privacypolicy.html"><small>Privacy Policy</small></a>';
    html += '\n                                       <br>';
    html += '\n                                       <small style="font-size: 10px;">Copyright \u00A9 2018 Anthony Santilli & Corey Lista</small>';
    html += '\n                                   </div>';

    html += '\n                               </div>';
    html += '\n                           </div>';
    html += '\n                           <button type="button" class="btn btn-sm btn-secondary mx-5 my-4" data-dismiss="modal">Close</button>';
    html += '\n                       </div>';
    html += '\n                   </div>';
    html += '\n               </div>';
    html += '\n           </div>';
    html += '\n       </div>';

    $('body').css({ 'overflow-x': 'hidden' });
    $('#bodyDiv').html(html);
}

const resultStrings = {
    inst_comp_text: {
        general: {
            install_complete: 'Install Process Completed!',
            update_complete: 'Update Process Completed!',
            app_removal_complete: 'SmartApp Removals Complete!<br/>Everything is Good!',
            device_removal_complete: 'Device Removals Complete!<br/>Everything is Good!',
            app_dev_removal_complete: 'SmartApp/Device Removals are Complete!<br/>Everything is Good!'
        },
        errors: {
            generic_error: 'Application Error:<br/><br/>',
            add_repo_error: 'Add Repo to IDE Error:<br/>Please Try Again Later<br/><br/>',
            auth_expired: 'Your Auth Session Expired.<br/>Please go back and sign in again',
            auth_issue: 'Authentication Issue!<br/>Make Sure you Signed In!',
            app_list_manifest_error: 'App Manifest Error:<br/>Unable to Retrieve App List<br/>',
            smartapp_manifest_error: 'SmartApp Manifest Error:<br/>App could not retrieve the file for:',
            device_install_error: 'Device Install Error:<br/></br>',
            device_update_error: 'Device Update Error:<br/><br/>',
            app_removal_error: 'App Removal Error:<br/><br/>',
            device_removal_error: 'Device Removal Error:<br/><br/>',
            app_setting_update_error: 'SmartApp Setting Update Error:<br/><br/>'
        }
    }
};

$.ajaxSetup({
    cache: true
});

function loadScripts() {
    $.getScript('https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js');
    $.getScript('https://cdnjs.cloudflare.com/ajax/libs/mdbootstrap/4.4.5/js/mdb.min.js');
}

document.addEventListener('DOMContentLoaded', function() {
    buildCoreHtml();
    loadScripts();
    loaderFunc();
});
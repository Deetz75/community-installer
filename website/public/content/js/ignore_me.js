'use esversion: 6';

const ESStackName = 'EchoSistantV5';
var functionArn = '';
var echoSistantAPIURL = '';
var repoId = '';
var writableRepos = [];
// var repoData = { owner: 'tonesto7', repoName: 'echosistant-alpha', branch: 'master', namespace: 'com.tonesto7'}
const repoData = { owner: 'tonesto7', repoName: 'laundry-wizard', branch: 'master', namespace: 'tonesto7' };
const appNames = { 'Laundry Wizard': 'smartapps/tonesto7/laundry-wizard.src/laundry-wizard.groovy' };
var installedSmartapps;
var availableApps;
var retryCnt = 0;
const authUrl = serverUrl + 'hub';
const fetchReposUrl = serverUrl + 'github/writeableRepos';
const updRepoUrl = serverUrl + 'githubAuth/updateRepos';
const updFormUrl = serverUrl + 'githubAuth/updateForm';
const doRepoUpdUrl = serverUrl + 'ide/app/doRepoUpdates';
const smartappsListUrl = serverUrl + 'ide/apps';
const availableSaUrl = serverUrl + 'api/smartapps/editable';

const appsManifest = [{
        namespace: 'tonesto7',
        repoName: 'nest-manager',
        name: 'NST Manager',
        author: 'Anthony S.',
        description: 'This SmartApp is used to integrate your Nest devices with SmartThings and to enable built-in automations',
        category: 'Convenience',
        videoUrl: 'http://f.cl.ly/items/3O2L03471l2K3E3l3K1r/Zombie%20Kid%20Likes%20Turtles.mp4',
        photoUrl: 'https://raw.githubusercontent.com/tonesto7/nest-manager/master/Images/App/nst_manager_icon.png',
        iconUrl: 'https://raw.githubusercontent.com/tonesto7/nest-manager/master/Images/App/nst_manager_icon.png',
        manifestUrl: 'https://raw.githubusercontent.com/tonesto7/nest-manager/master/installerManifest.json'
    },
    {
        namespace: 'tonesto7',
        repoName: 'echosistant-dev',
        name: 'EchoSistant Evolution',
        author: 'Anthony S.',
        description: 'The Ultimate Voice Controlled Assistant Using Alexa Enabled Devices.',
        category: 'My Apps',
        videoUrl: 'http://f.cl.ly/items/3O2L03471l2K3E3l3K1r/Zombie%20Kid%20Likes%20Turtles.mp4',
        photoUrl: 'https://echosistant.com/es5_content/images/Echosistant_V5.png',
        iconUrl: 'https://echosistant.com/es5_content/images/Echosistant_V5.png',
        manifestUrl: 'https://raw.githubusercontent.com/tonesto7/echosistant-dev/master/installerManifest.json'
    }
];

const installerManifests = [{
    namespace: 'tonesto7',
    repoName: 'echosistant-dev',
    name: 'EchoSistant Evolution',
    author: 'Anthony S.',
    description: 'The Ultimate Voice Controlled Assistant Using Alexa Enabled Devices.',
    category: 'My Apps',
    videoUrl: 'http://f.cl.ly/items/3O2L03471l2K3E3l3K1r/Zombie%20Kid%20Likes%20Turtles.mp4',
    photoUrl: 'https://echosistant.com/es5_content/images/Echosistant_V5.png',
    smartApp: {
        parent: {
            name: 'SmartAppName',
            iconUrl: 'https://echosistant.com/es5_content/images/Echosistant_V5.png',
            published: true,
            oAuth: true,
            appUrl: 'smartapps/Echo/echosistant5.src/echosistant5.groovy'
        },
        child: {
            '1': {
                name: 'ES-Profiles',
                iconUrl: 'https://echosistant.com/es5_content/images/es5_rooms.png',
                published: true,
                oAuth: false,
                appUrl: 'smartapps/Echo/es-profiles.src/es-profiles.groovy',
                optional: false
            },
            '2': {
                name: 'ES-Shortcuts',
                iconUrl: 'https://echosistant.com/es5_content/images/es5_shortcuts.png',
                published: true,
                oAuth: false,
                appUrl: 'smartapps/Echo/es-shortcuts.src/es-shortcuts.groovy',
                optional: false
            },
            '2': {
                name: 'ES-Storage',
                iconUrl: 'https://echosistant.com/es5_content/images/es5_storage.png',
                published: true,
                oAuth: false,
                appUrl: 'smartapps/Echo/es-storage.src/es-storage.groovy',
                optional: false
            }
        }
    }
}];

function makeRequest(url, method, message, appId = null, appDesc = null, contentType = null, responseType = null, allow500 = false) {
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
                } else if (xhr.status === 500 && allow500 === true) {
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

function addResult(str, good) {
    // $('#results').css({ display: 'none' });
    $('#resultList').css({
        display: 'block'
    });
    $('#resultsTitle').css({
        display: 'block'
    });
    let s = "<li><span style='color: " + (good !== false ? '#25c225' : '#FF0000') + ";'>";
    s += "<i class='fa fa-" + (good !== false ? 'check' : 'exclamation') + "'></i>";
    s += '</span> ' + str + '</li>';
    $('#resultList ul').append(s);
}

function installError(err, reload = true) {
    if (reload) {
        if (sessionStorage.refreshCount < 7) {
            loaderFunc();
        } else {
            installComplete(err, true);
        }
    }
}

function installComplete(text, red = false) {
    loaderDiv.style.display = 'none';
    $('#loaderDiv').css({
        display: 'none'
    });
    $('#finishedImg').removeClass('fa-exclamation-circle').addClass('fa-check').css({
        display: 'block'
    });
    if (red) {
        $('#finishedImg').removeClass('fa-check').addClass('fa-exclamation-circle').css({
            color: 'red'
        });
    }
    $('#results')
        .css({
            display: 'block'
        })
        .html(text + '<br/><br/>Press Back/Done Now');
    sessionStorage.removeItem('appsDone');
    sessionStorage.removeItem('refreshCount');
}

function updSectTitle(str, hide = false) {
    $('#sectTitle').html(str).css({ display: hide ? 'none' : 'block' });
    $('#sectTitleHr').css({ display: hide ? 'none' : 'block' });
}

function updLoaderText(str1, str2) {
    $('#loaderText1').text(str1);
    $('#loaderText2').text(str2);
}

function buildRepoParamString(rdata) {
    let objs = [];
    objs.push('referringController=appIde');
    objs.push('referringAction=apps');
    // objs.push('defaultNamespace=' + repoData.namespace);
    objs.push('repos.id=0');
    objs.push('repos.owner=' + repoData.namespace);
    objs.push('repos.name=' + repoData.repoName);
    objs.push('branch=' + repoData.branch);
    for (let i in rdata) {
        objs.push('repos.id=' + rdata[i].id);
        if (rdata[i].owner !== undefined) {
            objs.push('repos.owner=' + rdata[i].owner);
        }
        objs.push('repos.name=' + rdata[i].name);
        objs.push('repos.branch=' + rdata[i].branch);
    }
    return objs.join('&');
}

function buildAppInstallParams(repoid, apps) {
    let objs = [];
    objs.push('id=' + repoid);
    for (let i in apps) {
        objs.push('added=' + apps[i]);
    }
    objs.push('publishUpdates=true');
    objs.push('execute=Execute+Update');
    return objs.join('&');
}

function processIntall() {
    retryCnt++;
    getStAuth()
        .catch(function(err) {
            installError(err, false);
        })
        .then(function(resp) {
            if (resp === true) {
                checkIdeForRepo(repoData.repoName, 'master')
                    .catch(function(err) {
                        installError(err, false);
                    })
                    .then(function(resp) {
                        // console.log(resp);
                        if (resp === false) {
                            // addResult('', true);
                            addRepoToIde(repoData.repoName, 'master')
                                .catch(function(err) {
                                    installError(err, false);
                                })
                                .then(function(resp) {
                                    // console.log(resp);
                                    checkIdeForRepo(repoData.repoName, 'master')
                                        .catch(function(err) {
                                            installError(err, false);
                                        })
                                        .then(function(resp) {
                                            //   console.log(resp);
                                            if (resp === true && appNames) {
                                                checkIfAppsInstalled(appNames)
                                                    .catch(function(err) {
                                                        installError(err, false);
                                                    })
                                                    .then(function(resp) {
                                                        // console.log('checkIfAppsInstalled: ', resp);
                                                        if (Object.keys(resp).length) {
                                                            // installComplete('Installs are Complete!<br/>Everything is Good!');
                                                            installAppsToIde(resp)
                                                                .catch(function(err) {
                                                                    installError(err, false);
                                                                })
                                                                .then(function(resp) {
                                                                    console.log('installAppsToIde: ', resp);
                                                                    if (resp === true) {
                                                                        installComplete('Installs are Complete!<br/>Everything is Good!');
                                                                    }
                                                                });
                                                        } else {
                                                            installComplete('Installs are Complete!<br/>Everything is Good!');
                                                        }
                                                    });
                                            }
                                        });
                                });
                        } else {
                            addResult('Repo Exists: (' + repoData.repoName + ')', true);
                            checkIfAppsInstalled(appNames)
                                .catch(function(err) {
                                    installError(err, false);
                                })
                                .then(function(resp) {
                                    // console.log('checkIfAppsInstalled: ', resp);
                                    if (Object.keys(resp).length) {
                                        // installComplete('Installs are Complete!<br/>Everything is Good!');
                                        installAppsToIde(resp)
                                            .catch(function(err) {
                                                installError(err, false);
                                            })
                                            .then(function(resp) {
                                                // console.log('installAppsToIde: ', resp);
                                                if (resp === true) {
                                                    installComplete('Installs are Complete!<br/>Everything is Good!');
                                                }
                                            });
                                    } else {
                                        installComplete('Installs are Complete!<br/>Everything is Good!');
                                    }
                                });
                        }
                    });
            } else {
                if (retryCnt < 5) {
                    processIntall();
                } else {
                    installComplete('Authentication Issue!<br/>Make Sure you Signed In!', true);
                }
            }
        });
}

function getStAuth() {
    return new Promise(function(resolve, reject) {
        updLoaderText('Authenticating', 'Please Wait');
        makeRequest(authUrl, 'GET', null)
            .catch(function(err) {
                installError(err);
            })
            .then(function(response) {
                $('#results').text('');
                addResult('SmartThings Authentication', true);
                resolve(true);
            });
    });
}

function getAvailableApps(updDom = false) {
    return new Promise(function(resolve, reject) {
        // console.log('apps:', apps);
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
                }
                resolve(fndApps);
            });
    });
}

function checkIdeForRepo(rname, branch) {
    return new Promise(function(resolve, reject) {
        let repoFound = false;
        updLoaderText('Checking', 'Repos');
        makeRequest(fetchReposUrl, 'GET', null)
            .catch(function(err) {
                installError(err, false);
                addResult(err + ' Check Repo Issue', false);
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
                            repoId = respData[i].id;
                            repoFound = true;
                        }
                    }
                }
                resolve(repoFound);
            });
    });
}

function checkIfAppsInstalled(apps) {
    return new Promise(function(resolve, reject) {
        // console.log('apps:', apps);
        updLoaderText('Getting', 'Apps');
        makeRequest(availableSAs, 'GET', null)
            .catch(function(err) {
                installError(err, false);
                addResult(err + ' Getting SmartApps Issue', false);
                reject(err);
            })
            .then(function(resp) {
                // console.log(resp);
                let fndApps = JSON.parse(resp);
                if (fndApps.length) {
                    availableApps = fndApps;
                    updLoaderText('Analyzing', 'Apps');
                    for (let a in apps) {
                        let fnd = false;
                        for (let i in fndApps) {
                            console.log('fndApp: ', fndApps[i].name, ' | requested app: ' + a);
                            if (fndApps[i].name === a) {
                                addResult(a + ' Exists Already', true);
                                delete apps[a];
                                break;
                            }
                        }
                    }
                }
                resolve(apps);
            });
    });
}

function addRepoToIde(rname, branch) {
    return new Promise(function(resolve, reject) {
        let repoAdded = false;
        updLoaderText('Adding', 'Repo to ST');
        let repoParams = buildRepoParamString(writableRepos);
        // console.log('repoParams: ', repoParams);
        addResult('Repo Not Found - Adding to IDE', true);
        makeRequest(updRepoUrl, 'POST', repoParams, null, null, 'application/x-www-form-urlencoded', '', true)
            .catch(function(err) {
                installError(err, false);
                addResult(err + ' Add IDE Github Repo Issue', false);
                installComplete('Error!<br/>Try Again Later!', true);
                reject(err);
            })
            .then(function(resp) {
                console.log(resp);
                updLoaderText('Verifying', 'Repo');
                checkIdeForRepo(rname, 'master')
                    .catch(function(err) {
                        installError(err, false);
                        reject(err);
                    })
                    .then(function(resp) {
                        if (resp === true) {
                            addResult('Added Repo to IDE', true);
                            addResult('Verified Repo Added', true);
                        }
                        resolve(resp);
                    });
                resolve(false);
            });
    });
}

function installAppsToIde(appNames) {
    return new Promise(function(resolve, reject) {
        updLoaderText('Beginning', 'Installs');
        // console.log('repoParams: ', repoParams);
        if (appNames) {
            let repoParams = buildAppInstallParams(repoId, appNames);
            makeRequest(doRepoUpdUrl, 'POST', repoParams, null, null, 'application/x-www-form-urlencoded', '', true)
                .catch(function(err) {
                    installError(err, false);
                    addResult(err + ' Install Apps IDE Issue', false);
                    installComplete('Error!<br/>Try Again Later!', true);
                    reject(err);
                })
                .then(function(resp) {
                    updLoaderText('Apps', 'Installed');
                    for (let i in appNames) {
                        addResult(i + ' App Installed/Published', true);
                    }
                    resolve(true);
                });
        }
    });
}

function buildAppList() {
    let html = '';
    if (appsManifest.length > 0) {
        html += '<div id=listDiv class="col-lg-12 mb-r dark">';
        html += '   <div class="listGroup">';
        for (let i in appsManifest) {
            html += "     <a href='#' id='" + appsManifest[i].repoName + "' onclick='appItemClicked(this)' class='list-group-item list-group-item-action flex-column align-items-start'>";
            html += "         <div class='d-flex w-100 justify-content-between align-items-center'>";
            html += '             <h5 class="mb-1"><img src="' + appsManifest[i].iconUrl + '" height="40" class="d-inline-block align-middle" alt=""> ' + appsManifest[i].name + '</h5>';
            html += '             <small><b>Author:</b> ' + appsManifest[i].author + '</small>';
            html += '         </div>';
            html += "         <div class='d-flex w-100 justify-content-start align-items-center'>";
            html += "             <p class='mb-1 justify-content-start'>" + appsManifest[i].description + '</p>';
            html += '         </div>';
            html += '         <br/>';
            html += "         <div class='d-flex w-100 justify-content-between align-items-center'>";
            html += '             <small><b>Category:</b> ' + appsManifest[i].category + '</small>';
            html += '             <small class="align-middle"><b>Installs:</b> <span class="badge badge-primary badge-pill align-middle">14</span></small>';
            html += '         </div>';
            html += '     </a>';
        }
        html += '   </div>';
        html += '</div>';
    }
    updSectTitle('Select an Item');
    $('#listContDiv').append(html);
    $('#listContDiv').css({ display: 'block' });
    $('#loaderDiv').css({ display: 'none' });
    $('#actResultsDiv').css({ display: 'none' });
    $('#appViewDiv').css({ display: 'none' });
    new WOW().init();
}

function renderAppView(appName) {
    let html = '';
    if (appsManifest.length > 0) {
        html += '<div class="col-lg-12 mb-r">';
        let items = appsManifest.filter(app => app.repoName === appName);
        console.log(items);

        for (let i in items) {
            let manifests = installerManifests; // getManifest();
            for (let m in installerManifests) {
                updSectTitle('<h5 class="card-title align-center white-text" > <img src="' + installerManifests[m].smartApp.parent.iconUrl + '" height="40" class="d-inline-block align-middle align-center" alt=""> ' + installerManifests[m].name + '</h5>');
                console.log(installerManifests[m]);
                html += '     <!--Panel-->';
                html += '     <div class="card card-body">';
                html += '        <small class="black-text"><b>Author:</b> ' + installerManifests[m].author + '</small>';
                html += '        <div class="flex-column align-items-center">';
                html += '           <div class="d-flex w-100 justify-content-center">';
                html += '               <p class="card-text">' + installerManifests[m].description + '</p>';
                html += '           </div>';
                html += '       </div>';
                html += '       <div class="flex-row">';
                html += '          <a class="card-link">Card link</a>';
                html += '          <a class="card-link">Another link</a>';
                html += '       </div>';
                html += '     </div>';
                html += '     <!--/.Panel-->';
                html += '     <button id="installBtn" type="button" class="btn btn-success">Install</button>';
            }
        }
        html += '</div>';
    }

    $('#appViewDiv').append(html);
    $('#listContDiv').css({ display: 'none' });
    $('#loaderDiv').css({ display: 'none' });
    $('#actResultsDiv').css({ display: 'none' });
    $('#appViewDiv').css({ display: 'block' });
    new WOW().init();
}

function appItemClicked(appItem) {
    console.log('App Item Clicked: (' + appItem.id + ')');
    if (appItem.id) {
        renderAppView(appItem.id);
    }
}

async function loaderFunc() {
    $('#results').text('Waiting for connection...');
    if (sessionStorage.refreshCount === undefined) {
        sessionStorage.refreshCount = '0';
    }
    sessionStorage.refreshCount = Number(sessionStorage.refreshCount) + 1;
    updSectTitle('App Details', true);
    // $('#loaderDiv').css({ display: 'block' });
    await getStAuth()
        .catch(function(err) {
            installError(err, false);
        })
        .then(function(resp) {
            if (resp === true) {
                getAvailableApps(true)
                    .catch(function(err) {
                        installError(err, false);
                    })
                    .then(function(resp) {
                        if (resp.length) {
                            buildAppList();
                        }
                    });
            }
        });
}

$(document).ready(function() {
    loaderFunc();
});
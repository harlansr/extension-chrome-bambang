// //////////////////// EXTRA ////////////////////
// const browser = window.browser || window.chrome;
// const toContentScriptEventName = `ab-yt-channel-name-${Math.random().toString(36).substr(2)}`;
// const fromContentScriptEventName = `yt-ab-channel-name-${Math.random().toString(36).substr(2)}`;

// const injectScriptIntoTabJS = ({ src, name = "", params = {} }) => {
//     const scriptElem = document.createElement("script");
//     scriptElem.type = "module";
//     scriptElem.src = browser.runtime.getURL(src);
//     scriptElem.dataset.params = JSON.stringify(params);
//     scriptElem.dataset.name = name;
  
//     try {
//       (document.head || document.documentElement).appendChild(scriptElem);
//     } catch (err) {
//       // eslint-disable-next-line no-console
//       console.warn(err);
//     }
// };

// const runOnYT = function () {
//     injectScriptIntoTabJS({ src: "assets/purify.min.js" });
//     injectScriptIntoTabJS({
//         src: "assets/adblock-yt-capture-requests.js",
//         name: "capture-requests",
//         params: {
//             toContentScriptEventName,
//             fromContentScriptEventName,
//         },
//     });

//     // // process the event messages from the injected script // TODO: Caritau gunanya
//     // window.addEventListener("message", (event) => {
//     //     if (!event && !event.data) {
//     //         return;
//     //     }

//     //     if (event.data.channelName && event.data.eventName === toContentScriptEventName) {
//     //         gChannelName = event.data.channelName;
//     //         if (event.data.videoId) {
//     //             gNextVideoId = event.data.videoId;
//     //         }

//     //         browser.runtime.sendMessage({
//     //             command: "updateYouTubeChannelName",
//     //             channelName: event.data.channelName,
//     //         });
//     //     }
//     // });
// };

// const addScript = async function () {
//     try {
//         runOnYT();
//     } catch (err) {
//         console.error(err);
//     }
// };

// const init = async function () {
//     // browser.runtime.onMessage.addListener(onMessage);
//     await addScript();
// };


/////////////////////////// MAIN /////////////////////////

( async ()=>{
    console.log("+++++ SCHRIPT START +++++");
    // await init();
    let youtbueLeftControls, youtubePlayer;
    let currentVideo = "";
    let currentVideoBookmarks = [];

    
    /////////////////// ADS ///////////////////
    const adsBlock =()=>{
        const targetNode = document.querySelector('.video-ads');
        if (targetNode) {
            const observer = new MutationObserver((mutationsList) => {
                for (let mutation of mutationsList) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        const skipButtons = document.querySelectorAll('[id^="skip-button:"]');
                        skipButtons.forEach(element => {
                            element.style.display = 'block';
                        })
                    }
                }
            });

            observer.observe(targetNode, {
                childList: true,
                subtree: true,
            });
        }
    }
    

    chrome.runtime.onMessage.addListener((obj, sender, response)=>{
        const {type, value, videoId} = obj;

        switch (type) {
            case "NEW":
                currentVideo = videoId;
                adsBlock();
                newVideoLoaded();
                break;
            case "PLAY":
                youtubePlayer.currentTime = value;
                break;
            case "DELETE":
                currentVideoBookmarks = currentVideoBookmarks.filter((b)=>b.time != value);
                chrome.storage.sync.set({[currentVideo]: JSON.stringify(currentVideoBookmarks)})

                response(currentVideoBookmarks);
                break;
        }
    });

    const fetchBookmarks = ()=>{
        return new Promise((resolve)=>{
            chrome.storage.sync.get([currentVideo], (obj)=>{
                resolve(obj[currentVideo]? JSON.parse(obj[currentVideo]): []);
            });
        });
    }
    

    const newVideoLoaded = async ()=>{
        console.log("=== START ===")

        youtubePlayer = document.getElementsByClassName("video-stream")[0];
        ////////////////////////////////////
        const bookmarkBtnExists = document.getElementById("btn-bookmark");
        currentVideoBookmarks = await fetchBookmarks();

        /////////////////// BOOKMARK ///////////////////

        if(!bookmarkBtnExists){
            const bookmarkBtn = document.createElement("img");
    
            bookmarkBtn.src = chrome.runtime.getURL("assets/icons/book-bookmark-icon.png");
            bookmarkBtn.className = "ytp-button bookmark-btn"
            bookmarkBtn.title = "Bookmark current timestamp"
            bookmarkBtn.id = "btn-bookmark"
            // bookmarkBtn.style.paddingTop = "2rem";
            // bookmarkBtn.style.paddingBottom = "2rem";
    
            const videoControls_L = document.getElementsByClassName("ytp-left-controls")[0]
            const videControls_R = document.getElementsByClassName("ytp-right-controls")[0]
    
            videoControls_L.appendChild(bookmarkBtn)
            // videControls_R.prepend(bookmarkBtn)
    
            bookmarkBtn.addEventListener("click",addNewBookmarkHandler)
        }

    }

    const addNewBookmarkHandler = async ()=>{
        const currentTime = youtubePlayer.currentTime;
        const newBookmark = {
            time: currentTime,
            desc: "Bookmark at "+getTime(currentTime)
        };

        currentVideoBookmarks = await fetchBookmarks();

        // alert(newBookmark.desc);
        await chrome.storage.sync.set({
            [currentVideo]: JSON.stringify([...currentVideoBookmarks, newBookmark].sort((a,b)=>a.time - b.time))
        })
    }

})();

const getTime = t=>{
    var date = new Date(0);
    date.setSeconds(t);

    return date.toISOString().substr(11,8);
}

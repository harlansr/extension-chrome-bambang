// chrome.tabs.onUpdated.addListener((tabId, tab)=>{
//     if(tab.url && tab.url.includes("youtube.com/watch")){
//         const queryParameters = tab.url.split("?")[1];
//         const urlParameters = new URLSearchParams(queryParameters);

//         console.log("urlParameters :", urlParameters)

//         chrome.tabs.sendMessage(tabId, {
//             type: "NEW",
//             videoId: urlParameters.get("v")
//         })
//     }
// })

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Pastikan halaman sudah selesai dimuat
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes("youtube.com/watch")) {
        const queryParameters = tab.url.split("?")[1];
        const urlParameters = new URLSearchParams(queryParameters);

        console.log("urlParameters :", urlParameters);

        chrome.tabs.sendMessage(tabId, {
            type: "NEW",
            videoId: urlParameters.get("v")
        });
    }
});
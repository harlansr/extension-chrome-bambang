import { getActiveTabURL } from "./utils.js";

const addNewBookmark = (bookmarksElement, bookmark) => {
    const bookmarkTitle = document.createElement("div");
    const newBookmark = document.createElement("div");
    const controlsElement = document.createElement("div");

    bookmarkTitle.textContent = bookmark.desc;
    bookmarkTitle.className = "bookmark-title";

    controlsElement.className = "bookmark-controller";

    newBookmark.id = "bookmark-"+bookmark.time;
    newBookmark.className = "bookmark";
    newBookmark.setAttribute("timestamp", bookmark.time);

    setBookmarkAttributes("delete", onDelete, controlsElement);
    setBookmarkAttributes("play", onPlay, controlsElement);

    newBookmark.appendChild(bookmarkTitle);
    newBookmark.appendChild(controlsElement);
    bookmarksElement.appendChild(newBookmark);


};

const viewBookmarks = (currentBookmarks=[]) => {
    const bookmarksElement = document.getElementById("yt-bookmarks")
    bookmarksElement.innerHTML = "";

    if(currentBookmarks.length === 0){
        bookmarksElement.innerHTML=`<i class="row text-center text-none">No bookmarks to show</i>`
        return;
    }
    currentBookmarks.forEach(element => {
        addNewBookmark(bookmarksElement, element)
    });

};

const onPlay = async e => {
    const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
    const activeTab = await getActiveTabURL();

    chrome.tabs.sendMessage(activeTab.id, {
        type: "PLAY",
        value: bookmarkTime
    })
};

const onDelete = async e => {
    const activeTab = await getActiveTabURL();
    const bookmarkTime = e.target.parentNode.parentNode.getAttribute("timestamp");
    const bookmarkToDelete = document.getElementById("bookmark-"+bookmarkTime);

    bookmarkToDelete.parentNode.removeChild(bookmarkToDelete);

    chrome.tabs.sendMessage(activeTab.id,{
        type:"DELETE",
        value: bookmarkTime,
    }, viewBookmarks);
};

const setBookmarkAttributes = (src, event, controlParentElement) => {
    const controlElement = document.createElement("img");
    controlElement.src= "../assets/icons/"+src+".png";
    controlElement.title = src;
    controlElement.className = "img-btn img-h100"
    controlElement.addEventListener("click", event);
    controlParentElement.appendChild(controlElement);
};

const conYoutube = document.getElementById("container-youtube");
const txtIDR = document.getElementById("current_idr");

console.log("== SCRIPT ACTIVE ==");

document.addEventListener("DOMContentLoaded", async()=>{
    const activeTab = await getActiveTabURL();
    const queryParameters = activeTab.url.split("?")[1];
    const urlParameters = new URLSearchParams(queryParameters);

    const currentVideo = urlParameters.get("v");

    if(activeTab.url.includes("youtube.com/watch") && currentVideo){
        conYoutube.style.display = 'block';
        chrome.storage.sync.get([currentVideo], (data) => {
            const currentVideoBookmarks = data[currentVideo] ? JSON.parse(data[currentVideo]): [];
            viewBookmarks(currentVideoBookmarks);
        })
    }else{
        conYoutube.style.display = 'none';
    }

    getCurrency();
})


const getCurrency = ()=>{
    const username = 'lodestar';
    const password = 'pugsnax';
    const credentials = btoa(`${username}:${password}`); // encode ke base64

    fetch('https://cors-anywhere.herokuapp.com/https://www.xe.com/api/protected/midmarket-converter/', {
        method: 'GET', // atau 'POST', 'PUT', dll tergantung kebutuhan
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Origin': 'https://www.xe.com/',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const currentIDR =  Math.round(data.rates.IDR);
        txtIDR.innerHTML = `<b>USD</b> = Rp${currentIDR.toLocaleString('id-ID')}`
    })
    .catch(error => {
        console.error('Terjadi kesalahan:', error);
    });
}
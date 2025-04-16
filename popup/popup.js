import { formatNumber, getActiveTabURL } from "./utils.js";

let price_list = {};
let price_list_own = {
    usd: 0,
    gold: 25.6,
};

document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

const viewWebBookmark = ()=>{
    const bookmarksWebElement = document.getElementById("web-bookmark")
    bookmarksWebElement.innerHTML = "";

    

    const webBookmarks = [
        {
            group: "Project",
            title: "Birdmate",
            href: "https://docs.google.com/spreadsheets/d/1-3UJSgsnpfx8Phu30HV67aZvuYTuFINxcLfHWk7nQFk/edit?gid=0#gid=0",
        },
        {
            group: "Project",
            title: "Upgrade Medion",
            href: "https://docs.google.com/spreadsheets/d/1iwH3t5xBtmzuTZywqFbJQqr4eMTli3EyuksfAvNckWs/edit?pli=1&gid=1991938989#gid=1991938989&fvid=1686224001",
        },
        {
            group: "Chart",
            title: "GOTO",
            href: "https://www.indopremier.com/#ipot/app/advanced-chart?code=GOTO",
        },
        {
            group: "Chart",
            title: "BMRI",
            href: "https://www.indopremier.com/#ipot/app/advanced-chart?code=BMRI",
        },
    ];

    if(!webBookmarks.length){
        bookmarksWebElement.innerHTML=`<i class="row text-center text-none">No bookmarks to show</i>`
        return;
    }

    webBookmarks.sort((a, b) => a.group.localeCompare(b.group));
    webBookmarks.forEach((element, i) => {
        addWebBookmark(i, bookmarksWebElement, element)
    });
    
}

const addWebBookmark = (i, bookmarksWebElement, bookmark) =>{
    const newBookmark = document.createElement("div");
    const bookmarkTitle = document.createElement("div");

    bookmarkTitle.textContent = `${bookmark.group} - ${bookmark.title}`;
    bookmarkTitle.className = "bookmark-title";

    newBookmark.id = "web-bookmark-" + i;
    newBookmark.className = "bookmark";
    newBookmark.setAttribute("href", bookmark.href);

    newBookmark.appendChild(bookmarkTitle);
    // newBookmark.appendChild(controlsElement);
    bookmarksWebElement.appendChild(newBookmark);

    bookmarkTitle.addEventListener("click",()=>{
        chrome.tabs.create({ url: bookmark.href });
    })
}

const addNewBookmark = (bookmarksElement, bookmark) => {
    const newBookmark = document.createElement("div");
    const bookmarkTitle = document.createElement("div");
    const controlsElement = document.createElement("div");

    bookmarkTitle.textContent = bookmark.desc;
    bookmarkTitle.className = "bookmark-title";

    controlsElement.className = "bookmark-controller";

    newBookmark.id = "bookmark-"+bookmark.time;
    newBookmark.className = "bookmark";
    newBookmark.setAttribute("timestamp", bookmark.time);

    setBookmarkAttributes("delete", onDelete, controlsElement);
    // setBookmarkAttributes("play", onPlay, controlsElement);

    newBookmark.appendChild(bookmarkTitle);
    newBookmark.appendChild(controlsElement);
    bookmarksElement.appendChild(newBookmark);

    bookmarkTitle.addEventListener("click",onPlay)


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
    const bookmarkTime = e.target.parentNode.getAttribute("timestamp");
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
const txtUSD = document.getElementById("current_usd");
const txtGold = document.getElementById("current_gold");
const txtUSD_own = document.getElementById("current_usd_own");
const txtGold_own = document.getElementById("current_gold_own");

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

    const blurTexts = document.getElementsByClassName("text-blur");
    Array.from(blurTexts).forEach(element => {
        element.addEventListener("click", () => {
            element.classList.toggle("text-blur");
        });
    });

    viewWebBookmark();
    getPrice();
})

const getPrice = async ()=>{
    
    price_list = await priceLoad();
    console.log("--- PRICE: ", price_list, price_list.silver);

    const divLoading = ` <div class="spinner-border spinner-border-sm text-warning" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
    if(price_list.usd){
        const currentIDR =  Math.round(price_list.usd);
        txtUSD.innerHTML = formatNumber(currentIDR);
        txtUSD_own.innerHTML = formatNumber(currentIDR*price_list_own.usd);
        txtUSD.classList.add("text-warning");
    }
    if(price_list.gold){
        txtGold.innerHTML = formatNumber(price_list.gold);
        txtGold_own.innerHTML = formatNumber(price_list.gold*price_list_own.gold);
        txtGold.classList.add("text-warning");
    }
    
    getPriceCurrency();
    getPriceGold();
}

const priceLoad = ()=>{
    return new Promise((resolve)=>{
        chrome.storage.sync.get(["price"], (obj)=>{
            resolve(obj["price"]? JSON.parse(obj["price"]): {});
        });
    });
}

const priceSave = (type, value)=>{
    price_list[type] = value;
    chrome.storage.sync.set({
        ["price"]: JSON.stringify(price_list)
    })
}


const getPriceCurrency = ()=>{
    const username = 'lodestar';
    const password = 'pugsnax';
    const credentials = btoa(`${username}:${password}`); // encode ke base64

    fetch('https://cors-anywhere.herokuapp.com/https://www.xe.com/api/protected/midmarket-converter/', {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Origin': 'https://www.xe.com/',
        }
    })
    .then(response => {
        if (!response.ok) {
            // console.log("Status:", response.status)
            if(response.status ==403){
                chrome.tabs.create({ url: "https://cors-anywhere.herokuapp.com/corsdemo" });
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const currentIDR =  Math.round(data.rates.IDR);
        txtUSD.innerHTML = formatNumber(currentIDR);
        txtUSD_own.innerHTML = formatNumber(currentIDR*price_list_own.usd);
        txtUSD.classList.remove("text-warning");
        
        if(currentIDR>price_list.usd){
            txtUSD.classList.add("text-danger");
        }else{
            txtUSD.classList.add("text-primary");
        }
        priceSave("usd",currentIDR);
    })
    .catch(error => {
        console.error('Terjadi kesalahan:', error);
    });
}

const getPriceGold = ()=>{
    fetch('https://logam-mulia-api.vercel.app/prices/anekalogam', {
        method: 'GET',
    })
    .then(response => {
        if (!response.ok) {
            // console.log("Status:", response.status)
            if(response.status ==403){
                chrome.tabs.create({ url: "https://cors-anywhere.herokuapp.com/corsdemo" });
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const price_new = data.data[0].buy;
        txtGold.innerHTML = formatNumber(price_new);
        txtGold_own.innerHTML = formatNumber(price_new*price_list_own.gold);
        txtGold.classList.remove("text-warning");
        if(price_new>=price_list.gold){
            txtGold.classList.add("text-primary");
        }else{
            txtGold.classList.add("text-danger");
        }
        priceSave("gold", price_new);
    })
    .catch(error => {
        console.error('Terjadi kesalahan:', error);
    });
};



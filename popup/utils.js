  export async function getActiveTabURL(){
    let queryOptions = {active: true, currentWindow: true};
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab
  }

  export function formatNumber(value){
    return value.toLocaleString('id-ID')
  }
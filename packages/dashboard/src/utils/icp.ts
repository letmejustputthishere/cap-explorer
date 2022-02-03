import dayjs from "dayjs";

let marketPrices = new Map();

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const getICPMarketPrice = async (
    date: string | undefined
): Promise<number> => {
    if (date === undefined) {
        return 0;
    }

    if (!marketPrices.has(date)) {
        marketPrices.set(date, undefined);
    } else {
        while (marketPrices.get(date) === undefined) {
            await sleep(1000);
        }
        return marketPrices.get(date);
    }

    let response = await fetch(
        `https://api.coingecko.com/api/v3/coins/internet-computer/history?date=${date}&localization=false`
    );
    let data = await response.json();

    let marketPrice = data.market_data.current_price.usd;

    marketPrices.set(date, marketPrice);

    return marketPrice;
};

export const toCoingeckoTime = (time: number) => {
    let date = dayjs(time).format("DD-MM-YYYY");
    return date;
};

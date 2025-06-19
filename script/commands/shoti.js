
const axios = require('axios');

const eurix = {
    name: "shoti",
    usage: "/shoti",
    description: "Get a random Shoti video",
    permission: "all",
};

async function execute(bot, msg) {
    const chatId = msg.chat.id;

    try {  
        await bot.sendMessage(chatId, "*🎥 Fetching a random Shoti video...*", { parse_mode: 'Markdown' });  

        const response = await axios.get("https://shoti.fbbot.org/api/get-shoti");  

        if (!response.data || !response.data.result || !response.data.result.content) {  
            throw new Error("Invalid response from Shoti API");  
        }  

        const { result: videoData } = response.data;
        const { user } = videoData;

        const caption = 
            "*🎀 Random Shoti Video*\n\n" +
            `*📌 Username:* [${user.username}](https://tiktok.com/@${user.username})\n` +
            `*🏷 Nickname:* ${user.nickname}\n` +
            `*📷 Instagram:* ${user.instagram ? `[${user.instagram}](https://instagram.com/${user.instagram})` : 'N/A'}\n` +
            `*🌍 Region:* ${videoData.region}\n` +
            `*⏳ Duration:* ${videoData.duration} ms\n` +
            `*🏆 Shoti Score:* ${videoData.shoti_score}\n` +
            `*🆔 Shoti ID:* \`${videoData.shoti_id}\`\n\n` +
            `*💠 Owner:* [@ZenoOnTop](https://t.me/ZenoOnTop)`;

        await bot.sendVideo(chatId, videoData.content, { 
            caption,
            parse_mode: 'Markdown'
        });  
    } catch (error) {  
        console.error("Shoti command error:", error.message || error);  
        await bot.sendMessage(chatId, "*❌ Failed to fetch Shoti video. Please try again later.*", { parse_mode: 'Markdown' });  
    }
}

module.exports = {
    eurix,
    execute
};

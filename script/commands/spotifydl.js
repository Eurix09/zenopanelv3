const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    eurix: {
        name: "spotify",
        description: "Download songs from Spotify",
        usages: "/spotify <song name>",
    },

    execute: async function(bot, msg, args) {
        const chatId = msg.chat.id;
        const query = args.join(" ");
        if (!query) {
            return bot.sendMessage(chatId, "⚠️ Please provide a song name to search!");
        }

        let processingMessage;
        try {
            // Initial search message
            processingMessage = await bot.sendMessage(chatId, "🔎 Searching...");

            // Make the request to your Spotify API or downloader
            const search = await axios.get(`https://betadash-search-download.vercel.app/spt?search=${encodeURIComponent(query)}`);
            const song = search.data;

            if (!song || !song.download_url) {
                await bot.sendMessage(chatId, "❌ Song not found or unavailable for download.");
                return;
            }

            // Edit the previous message (Telegram bots can't edit easily unless you store message_id)
            await bot.editMessageText(
                `🎵 Found: ${song.title} by ${song.artists}\n⏳ Downloading...`,
                {
                    chat_id: chatId,
                    message_id: processingMessage.message_id
                }
            );

            // Download MP3 file
            const mp3 = await axios({
                method: 'get',
                url: song.download_url,
                responseType: 'arraybuffer'
            });

            const filePath = path.join(__dirname, 'cache', `${song.title}.mp3`);
            fs.writeFileSync(filePath, Buffer.from(mp3.data));

            await bot.editMessageText("🎧 Almost done...", {
                chat_id: chatId,
                message_id: processingMessage.message_id
            });

            // Send audio file with song info
            await bot.sendAudio(chatId, fs.createReadStream(filePath), {
                caption: `🎵 ${song.title} - ${song.artists}\n⏱️ Duration: ${Math.floor(song.duration / 1000 / 60)}:${Math.floor(song.duration / 1000 % 60).toString().padStart(2, '0')}`
            });

            // Clean up
            fs.unlinkSync(filePath);
            await bot.deleteMessage(chatId, processingMessage.message_id);

        } catch (error) {
            console.error('Spotify Error:', error);
            if (processingMessage) {
                await bot.deleteMessage(chatId, processingMessage.message_id);
            }
            await bot.sendMessage(chatId, "❌ An error occurred while processing your request.");
        }
    }
};
const eurix = {
    name: "start",
    description: "Get started with bot commands",
    usage: "/start"
};

async function execute(bot, msg) {
    const chatId = msg.chat?.id;
    const user = msg.from;
    const username = user?.username || user?.first_name || "User";

    try {
        let botInfo = await bot.getMe(); // Get bot's info
        let botName = botInfo?.first_name || "Bot"; // Ensure a fallback name

        let userPhotos = null;

        // Fetch user profile photos
        try {
            const photos = await bot.getUserProfilePhotos(user.id);
            if (photos && photos.total_count > 0) {
                userPhotos = photos.photos[0][0]?.file_id || null;
            }
        } catch (photoError) {
            console.error("Profile photo error:", photoError);
        }

        const welcomeMessage = `
Hi *${username}*  

🤖 *Ako nga pala si ${botName}*  
📜 *Type /help to see all available commands!*
Avail ka Cheat? Dm molang bebe ko: [Click here](https://t.me/ZenoOnTop)`;

        // Send either a photo with text or just text
        if (userPhotos) {
            await bot.sendPhoto(chatId, userPhotos, {
                caption: welcomeMessage,
                parse_mode: "Markdown",
            });
        } else {
            await bot.sendMessage(chatId, welcomeMessage, {
                parse_mode: "Markdown",
            });
        }
    } catch (error) {
        console.error("Start Command Error:", error);
        await bot.sendMessage(chatId, "❌ An error occurred while processing your request.");
    }
}

module.exports = {
    eurix,
    execute,
};
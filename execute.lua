local userFile = "/storage/emulated/0/Download/UserData.txt"
local baseUrl = "https://zenopanelv3.onrender.com"

local function isInternetAvailable()
    local response = gg.makeRequest(baseUrl .. "/execute/info")
    return response and response.content ~= nil
end

if not isInternetAvailable() then
    gg.alert("❌ No Internet Connection! Please turn on Wi-Fi or mobile data.")
    os.exit()
end

local function saveCredentials(username, password)
    local file = io.open(userFile, "w+")
    if not file then
        return false, "Error: Could not save user credentials."
    end
    file:write(password)
    file:close()
    return true
end

local function loadCredentials()
    local file = io.open(userFile, "r")
    if not file then return "Eugene Aguilar", nil end

    local password = file:read("*l")
    file:close()

    if not password or password == "" then
        os.remove(userFile)
        return "Eugene Aguilar", nil
    end

    return "Eugene Aguilar", password
end

local function getDeviceInfo()
    local response = gg.makeRequest(baseUrl .. "/execute/info")
    if not response or not response.content then
        return nil
    end

    local zip = response.content:match('"zip"%s*:%s*"([^"]+)"')
    if not zip or zip == "" then
        zip = response.content:match('"code"%s*:%s*"([^"]+)"')
    end

    return zip
end

local function checkCredentials(username, password)
    if not password or password == "" then
        gg.alert("❌ Invalid password!")
        os.remove(userFile)
        os.exit()
    end

    local url = string.format("%s/execute?username=%s&apiKey=%s", baseUrl, username, password)
    local response = gg.makeRequest(url)

    if not response or not response.content then
        gg.alert("❌ Error: Connection failed. Check your internet.")
        os.remove(userFile)
        os.exit()
    end

    local data = response.content
    local errorMsg = data:match('"error"%s*:%s*"([^"]+)"')
    local message = data:match('"message"%s*:%s*"([^"]+)"')
    local deviceType = data:match('"type"%s*:%s*"([^"]+)"')
    local zipCode = data:match('"zipCode"%s*:%s*"([^"]+)"')
    local remainingDays = data:match('"Remaining Days"%s*:%s*(%d+)')
    local status = data:match('"status"%s*:%s*"([^"]+)"')
    local serverVersion = data:match('"version"%s*:%s*"([^"]+)"')
    local userVersion = data:match('"userVersion"%s*:%s*"([^"]+)"')

    if errorMsg and errorMsg ~= "" then
        gg.alert("❌ " .. errorMsg)
        os.remove(userFile)
        os.exit()
    end

    if not status or status ~= "Success" then
        gg.alert("❌ Invalid key or authentication failed!")
        os.remove(userFile)
        os.exit()
    end

    -- Version checking
    local version = "1.2"
    if serverVersion and version ~= serverVersion then
        gg.alert("🔄 Please contact the owner for new update")
        os.exit()
    end

    

    if remainingDays then
        local days = tonumber(remainingDays)
        if days and days > 0 then
            local displayMessage = string.format(
                "✅ Status: %s\n📱 Device Type: %s\n📍 ZIP Code: %s\n⏳ Days Remaining: %s days\n🔧 Version: %s",
                status,
                deviceType or "Unknown",
                zipCode or "Unknown",
                days,
                version
            )
            gg.alert(displayMessage)
            return true
        end
    end

    gg.alert("❌ Key has expired or is invalid!")
    os.remove(userFile)
    os.exit()
end

-- Main logic
local username, password = loadCredentials()

if not username or not password then
    local zipCode = getDeviceInfo()
    if not zipCode then
        gg.alert("The server panel is down or cannot be reached. Please contact the owner on Telegram: @ZenoOnTop")
        os.exit()
    end

    local codeChoice = gg.choice({
        "📋 COPY MY CODE",
        "🔑 LOGIN",
        "❌ CANCEL"
    }, nil, "Your Device Code is: " .. zipCode)

    if not codeChoice then os.exit() end

    if codeChoice == 1 then
        gg.copyText(zipCode)
        gg.toast("✅ Code Copied! Please send it to the owner.")
        os.exit()
    elseif codeChoice == 3 then
        os.exit()
    end

    local credentials = gg.prompt(
        {"ZenoOnTopVIPScript\nYOUR CODE IS " .. zipCode .. "\nEnter Password:"},
        {""},
        {"text"}
    )

    if not credentials then
        gg.alert("Login canceled.")
        os.exit()
    end

    if not credentials[1] or credentials[1] == "" then
        gg.alert("Password cannot be empty!")
        os.exit()
    end

    username, password = "Eugene Aguilar", credentials[1]
    local saved, err = saveCredentials(username, password)
    if not saved then
        gg.alert(err)
        os.exit()
    end
end

if checkCredentials(username, password) then
    gg.toast("✨ Welcome, VIP User!")
end

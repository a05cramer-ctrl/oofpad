-- OOFBoard · read-only
-- Shows this game's OOFPAD coin and the passes OOFPAD has bought, in a small corner panel.
-- 1) Game Settings > Security > Allow HTTP Requests = ON
-- 2) Put this Script in ServerScriptService
-- It only reads one URL. No purchases, no remotes, no player data sent anywhere.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local API = "{{ORIGIN}}/api/oof?place=" .. tostring(game.PlaceId)
local REFRESH = 60

local state = {
	title = "OOFPAD",
	line1 = "no coin for this game yet",
	line2 = "",
}

local function commas(n: number): string
	local s = tostring(math.floor(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (out:gsub("^,", ""))
end

local function label(parent: Instance, name: string, y: number, size: number, bold: boolean)
	local t = Instance.new("TextLabel")
	t.Name = name
	t.BackgroundTransparency = 1
	t.Position = UDim2.fromOffset(12, y)
	t.Size = UDim2.new(1, -24, 0, size + 4)
	t.Font = bold and Enum.Font.FredokaOne or Enum.Font.GothamBold
	t.TextSize = size
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.TextColor3 = Color3.fromRGB(26, 34, 64)
	t.Text = ""
	t.Parent = parent
	return t
end

local function build(player: Player)
	local pg = player:WaitForChild("PlayerGui")
	if pg:FindFirstChild("OOFBoard") then return end
	local gui = Instance.new("ScreenGui")
	gui.Name = "OOFBoard"
	gui.ResetOnSpawn = false
	local f = Instance.new("Frame")
	f.Name = "Panel"
	f.AnchorPoint = Vector2.new(1, 0)
	f.Position = UDim2.new(1, -12, 0, 64)
	f.Size = UDim2.fromOffset(250, 76)
	f.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	f.Parent = gui
	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0, 14); c.Parent = f
	local s = Instance.new("UIStroke"); s.Thickness = 3; s.Color = Color3.fromRGB(26, 34, 64); s.Parent = f
	label(f, "Title", 6, 20, true)
	label(f, "Line1", 32, 14, false)
	label(f, "Line2", 52, 14, false)
	gui.Parent = pg
end

local function render()
	for _, p in Players:GetPlayers() do
		local pg = p:FindFirstChild("PlayerGui")
		local gui = pg and pg:FindFirstChild("OOFBoard")
		if gui then
			gui.Panel.Title.Text = state.title
			gui.Panel.Line1.Text = state.line1
			gui.Panel.Line2.Text = state.line2
		end
	end
end

local function poll()
	local ok, body = pcall(function()
		return HttpService:GetAsync(API, true)
	end)
	if not ok then return end
	local ok2, data = pcall(function()
		return HttpService:JSONDecode(body)
	end)
	if not ok2 or type(data) ~= "table" then return end
	if data.coin and data.coin.ticker then
		state.title = "$" .. tostring(data.coin.ticker) .. "  ·  this game's coin"
	else
		state.title = "OOFPAD"
	end
	state.line1 = data.coin and ("passes bought by OOFPAD: " .. commas(data.bought or 0)) or "no coin for this game yet"
	state.line2 = commas(data.playing or 0) .. " playing right now"
	render()
end

Players.PlayerAdded:Connect(function(p)
	build(p)
	render()
end)
for _, p in Players:GetPlayers() do
	task.spawn(build, p)
end

while true do
	poll()
	task.wait(REFRESH)
end

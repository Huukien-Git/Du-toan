Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
appUrl = "http://localhost:3000"
fallbackFile = currentDir & "\index.html"

' Khởi động node server.js nếu có node
On Error Resume Next
WshShell.Run "node """ & currentDir & "\server.js""", 0, False
WScript.Sleep 1000
On Error GoTo 0

targetUrl = appUrl

chrome64 = "C:\Program Files\Google\Chrome\Application\chrome.exe"
chrome32 = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
chromeUser = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"

edge32 = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
edge64 = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
edgeUser = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(chrome64) Then
    WshShell.Run """" & chrome64 & """ --app=""" & targetUrl & """ --window-size=1440,900", 1, False
ElseIf fso.FileExists(chrome32) Then
    WshShell.Run """" & chrome32 & """ --app=""" & targetUrl & """ --window-size=1440,900", 1, False
ElseIf fso.FileExists(chromeUser) Then
    WshShell.Run """" & chromeUser & """ --app=""" & targetUrl & """ --window-size=1440,900", 1, False
ElseIf fso.FileExists(edge32) Then
    WshShell.Run """" & edge32 & """ --app=""" & targetUrl & """ --window-size=1440,900", 1, False
ElseIf fso.FileExists(edge64) Then
    WshShell.Run """" & edge64 & """ --app=""" & targetUrl & """ --window-size=1440,900", 1, False
ElseIf fso.FileExists(edgeUser) Then
    WshShell.Run """" & edgeUser & """ --app=""" & targetUrl & """ --window-size=1440,900", 1, False
Else
    WshShell.Run """" & targetUrl & """", 1, False
End If

; Ritemark Windows Installer Script
; Built with Inno Setup 6.x
;
; Usage:
;   ISCC.exe /DSourcePath="C:\path\to\VSCode-win32-x64" ritemark.iss
;
; See docs/BUILD-WINDOWS-INSTALLER.md for full instructions.

; Allow SourcePath to be passed from command line
#ifndef SourcePath
  #define SourcePath "..\..\VSCode-win32-x64"
#endif

; Allow IconPath to be passed from command line
#ifndef IconPath
  #define IconPath "..\..\branding\icons\icon.ico"
#endif

#define AppName "Ritemark"
; Keep in sync with extensions/ritemark/package.json version
#define AppVersion "1.5.0"
#define AppPublisher "Productory"
#define AppURL "https://ritemark.app"
#define AppExeName "Ritemark.exe"
#define AppMutex "ritemarknative"

[Setup]
AppId={{B8F5E4A2-7C3D-4E9F-A1B6-8D2E5F3C9A7B}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
OutputDir=..\..\installer-output
OutputBaseFilename=Ritemark-{#AppVersion}-win32-x64-setup
Compression=lzma2
SolidCompression=yes
; Use modern wizard style
WizardStyle=modern
; Setup icon (pass /DIconPath="..." if relative path doesn't work)
SetupIconFile={#IconPath}
; Uninstall icon
UninstallDisplayIcon={app}\{#AppExeName}
; Windows 10+ only
MinVersion=10.0
; 64-bit only
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Mutex to prevent running during install
AppMutex={#AppMutex}
; Don't require admin by default (user install)
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "associatewithfiles"; Description: "Associate with .md files"; GroupDescription: "File associations:"
Name: "addtopath"; Description: "Add to PATH"; GroupDescription: "Other:"

[Files]
; Copy everything from the built app, excluding deeply nested node_modules that exceed MAX_PATH (260 chars)
; NOTE: docx\build IS needed for Word export - do NOT exclude it
Source: "{#SourcePath}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*\node_modules\*\node_modules\*\node_modules\*"

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[Registry]
; Associate .md files with Ritemark
Root: HKCU; Subkey: "Software\Classes\.md"; ValueType: string; ValueName: ""; ValueData: "Ritemark.md"; Flags: uninsdeletevalue; Tasks: associatewithfiles
Root: HKCU; Subkey: "Software\Classes\Ritemark.md"; ValueType: string; ValueName: ""; ValueData: "Markdown File"; Flags: uninsdeletekey; Tasks: associatewithfiles
Root: HKCU; Subkey: "Software\Classes\Ritemark.md\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExeName},0"; Tasks: associatewithfiles
Root: HKCU; Subkey: "Software\Classes\Ritemark.md\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExeName}"" ""%1"""; Tasks: associatewithfiles

; Also associate .markdown files
Root: HKCU; Subkey: "Software\Classes\.markdown"; ValueType: string; ValueName: ""; ValueData: "Ritemark.md"; Flags: uninsdeletevalue; Tasks: associatewithfiles

; Add to PATH
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}\bin"; Tasks: addtopath; Check: NeedsAddPath('{app}\bin')

[Code]
function NeedsAddPath(Param: string): Boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath) then
  begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Param + ';', ';' + OrigPath + ';') = 0;
end;

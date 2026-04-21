!macro customInit
  ReadRegStr $0 SHCTX "Software\\Diaster Wholesale" "InstallDir"
  StrCmp $0 "" +2
  StrCpy $INSTDIR $0
!macroend

!macro customInstall
  WriteRegStr SHCTX "Software\\Diaster Wholesale" "InstallDir" "$INSTDIR"
!macroend

!macro customUnInstall
  DeleteRegKey SHCTX "Software\\Diaster Wholesale"
!macroend

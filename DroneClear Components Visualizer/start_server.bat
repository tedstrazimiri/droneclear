@echo off
echo Starting local web server...
echo The DroneClear Components Visualizer will open in your default browser.
echo Press Ctrl+C in this window to stop the server when you are done.
echo.
start http://localhost:8000
python -m http.server 8000

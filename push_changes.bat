@echo off
cd /d C:\Users\vrajr\Downloads\BreastCancerDetect\BreastCancerDetect

echo ========================================
echo Pushing updates to GitHub
echo ========================================
echo.

git add -A
git commit -m "Add root route, update backend URL"
git push origin main

echo.
echo Done! Render will auto-deploy.
echo ========================================
pause

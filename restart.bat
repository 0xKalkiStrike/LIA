@echo off  
timeout /t 2 /nobreak  
taskkill /F /PID 11884  
timeout /t 2 /nobreak  
python run.py 

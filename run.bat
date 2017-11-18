:: Start MongoDB server (if server is local). 
set db="C:/data/db/"

start cmd /k mongod --dbpath %db%

:: Run npm install and start the application
call npm install
npm start

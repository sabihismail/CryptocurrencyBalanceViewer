:: Start MongoDB server (if server is local). 
set db="C:/data/db/"

start cmd /k mongod --dbpath %db%

:: Start the application
npm start

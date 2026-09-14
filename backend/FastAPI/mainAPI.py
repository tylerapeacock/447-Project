from fastapi import FastAPI
app = FastAPI()
# Temporary data
# List of departments
@app.get("/departmentInfo")
def getDepartments(): 
    return [
        {"Department ID" : 1, "Department Name" : "Retriever Essentials"},
        {"Department ID" : 2, "Department Name" : "Retriever Care"},
        {"Department ID" : 3, "Department Name" : "Student Engagement & Belonging"},
        {"Department ID" : 4, "Department Name" : "Center for Religion, Spirituality, & Pluralism"},
        {"Department ID" : 5, "Department Name" : "Student Conduct & Community Standards"},
        {"Department ID" : 6, "Department Name" : "Student Support & Outreach"}
]
# List of student information
@app.get("/studentInfo")
def getStudents():
    return [
        {"Student ID" : 1, "Student's Name" : "Student 1"},
        {"Student ID" : 2, "Student's Name" : "Student 2"},
        {"Student ID" : 3, "Student's Name" : "Student 3"}
]

# Need to add later: 
# There is no current Student Engagment & Belonging director, 
# There is no current Assistant Director, Retriever Care (Student Support & Outreach)
# There's no current Student Conduct & Community Standards director.
@app.get("/usersInfo")
def getUsers():
    return [
        # Administration of Dean of Students
        {"User ID" : 1, "User's Name" : "Jacob Diaz"},
        {"User ID" : 2, "User's Name" : "Jennifer Artis"},
        {"User ID" : 3, "User's Name" : "Victoria Hall"},
        {"User ID" : 4, "User's Name" : "Lesa Goodhue"},
        {"User ID" : 5, "User's Name" : "Ashley Hickson"},
        {"User ID" : 6, "User's Name" : "Amanda Turner"},
        # Student Engagement & Belonging
        {"User ID" : 7, "User's Name" : "Sarah Casper-Woodhead"},
        {"User ID" : 8, "User's Name" : "Mitchell Everett"},
        {"User ID" : 9, "User's Name" : "Lorae Lohve"},
        {"User ID" : 10, "User's Name" : "Abdoulie Sarr"},
        {"User ID" : 11, "User's Name" : "Endia Scales"},
        {"User ID" : 12, "User's Name" : "Jen Ewing Fox"},
        {"User ID" : 13, "User's Name" : "Angelina Jenkins"},
        {"User ID" : 14, "User's Name" : "Tori Ciorra"},
        # Student Support & Outreach
        {"User ID" : 15, "User's Name" : "Griselda Flores"},
        {"User ID" : 16, "User's Name" : "Sue Poandl"},
        {"User ID" : 17, "User's Name" : "Michael Berardi"},
        {"User ID" : 18, "User's Name" : "Dennis Walker"},
        {"User ID" : 19, "User's Name" : "Karsyn Modeski"},
        {"User ID" : 20, "User's Name" : "Cassandra Dobbs"},
        # Student Conduct & Community Standards
        {"User ID" : 21, "User's Name" : "Davonya Hall"},
        {"User ID" : 22, "User's Name" : "Seymour Chambers"},
        {"User ID" : 23, "User's Name" : "Monica Green"},
        {"User ID" : 24, "User's Name" : "Precious Anyadike"},
        # Center for Religion, Spirituality & Pluralism
        {"User ID" : 25, "User's Name" : "Matt Hoffman"},
        {"User ID" : 26, "User's Name" : "Joseph Vann-Jones"}
]
@app.get("/")
def home():
    return {"message": "Hello World"}

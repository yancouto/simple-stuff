import xml.etree.ElementTree as ET
import datetime
import sqlite3
from shutil import copyfile

TSHEET = 'Timesheet.xml'
JIFFY_EMPTY = 'Jiffy_empty.db'
JIFFY_OUT = 'Jiffy_LG-D855-123123.db'


pid2project = {}
class Project:
    def __init__(self, p):
        pid2project[p.findall('projectId')[0].text] = self
        for field in ['name', 'status', 'color']:
            setattr(self, field, p.findall(field)[0].text)
        self.key = object()
        self.parent = None
    def to_tuple(self):
        return (1, # userid
                self.name, # name
                self.color, # color
                'true' if self.status == 1 else 'false', # archived
                0, # worktime
                0, # rowState
                id(self), # uuidM
                id(self.key), # uuidL
                -3163649470106615801 if self.parent == None else id(self.parent), # parentUuidM
                -7251036291185311208 if self.parent == None else id(self.parent.key), # parentUuidL
                'true', # local
                'true', # expanded
                '', # serverTimestamp
                1509195055725, # lastChanged
                0, # sharedFromUuidM
                0) # sharedFromUuidL


root = ET.parse(TSHEET).getroot()
projects = []
for p in root.findall('projects/'):
    projects.append(Project(p))

def get_date(d):
    d = d[:-3] + d[-2:]
    return datetime.datetime.strptime(d, '%Y-%m-%dT%H:%M:%S%z')

tid2task = {}
class Task:
    def __init__(self, t):
        tid2task[t.findall('taskId')[0].text] = self
        self.project = pid2project[t.findall('projectId')[0].text]
        for field in ['description', 'startDate', 'endDate']:
            setattr(self, field, t.findall(field)[0].text)
        self.startDate = get_date(self.startDate)
        self.endDate = get_date(self.endDate)
        self.tags = []
    def to_tuple(self):
        return (1, # userid
                int(self.startDate.timestamp() * 1000), # starttime
                int(self.endDate.timestamp() * 1000), # stoptime
                0, # rowState
                self.description, # note
                'America/Sao_Paulo', # startzone
                'America/Sao_Paulo', # stopzone
                id(self), # uuidM
                id(self.startDate), # uuidL
                id(self.project), # ownerUuidM
                id(self.project.key), # ownerUuidL
                'true', # local
                -1, # serverTimestamp
                1509195002928, # lastChanged
                '', # worktime
                '') # locked


tasks = []
for t in root.findall('tasks/'):
    tasks.append(Task(t))

for b in root.findall('breaks/'):
    t = tid2task[b.findall('taskId')[0].text]
    start = get_date(b.findall('startDate')[0].text)
    end = get_date(b.findall('endDate')[0].text)
    t.endDate = t.endDate - (end - start)

tid2tag = {}
class Tag:
    def __init__(self, t):
        tid2tag[t.findall('tagId')[0].text] = self
        self.name = t.findall('name')[0].text

for t in root.findall('tags/'):
    Tag(t)

for tt in root.findall('taskTags/'):
    tag = tid2tag[tt.findall('tagId')[0].text]
    task = tid2task[tt.findall('taskId')[0].text]
    task.tags.append(tag.name)

copyfile(JIFFY_EMPTY, JIFFY_OUT)
conn = sqlite3.connect(JIFFY_OUT)
cur = conn.cursor()

contest = Project.__new__(Project)
contest.name = 'Contests'
contest.status = 0
contest.color = -3149
contest.key = object()
contest.parent = list(filter(lambda x : x.name == 'Maratona', projects))[0]

projects.append(contest)

for t in tasks:
    if t.project.name == 'Maratona' and ('Contest' in t.tags):
        t.project = contest

cur.executemany('insert into jiffy_time_tree values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', map(Project.to_tuple, projects))

cur.executemany('insert into jiffy_times values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', map(Task.to_tuple, tasks))

conn.commit()
conn.close()

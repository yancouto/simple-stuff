# Compiler
CXX = g++

# Compiler flags
CXXFLAGS = -std=c++23 -Wno-deprecated-declarations

DEBUG ?= 0
ifeq ($(DEBUG), 1)
	CXXFLAGS += -g
else
	CXXFLAGS += -O2
endif

%.exe: %.cpp *.h *.hpp graph.cpp
	$(CXX) $(CXXFLAGS) -o $@ $<

all: test_forest_cuts.exe

clean:
	rm -f *.exe
/*
	This provides a parser for the graph6 format by Brendan McKay as used in nauty.
*/

#ifndef GRAPH6_HPP
#define GRAPH6_HPP

#include <vector>
#include <stdexcept>
#include <cassert>
#include <iterator>
#include <utility>
#include <iostream>
#include <sstream>
#include <string>
#include <cassert>
#include <cmath>

/*Read a graph6 graph from an input stream. You can call this repeatedly on the same stream
  to get more than one graph, but this only works if the line endings are just one byte long, I think.*/
template<typename input_iterator>
struct read_graph6_edges : std::iterator<
	std::input_iterator_tag,
	std::pair<int, int>,
	ptrdiff_t,
	std::pair<int,int>*,
	std::pair<int,int>&>
{
	long num_nodes;
	const int packet_size;
	input_iterator* _in;
	bool eos;

	int column;
	int row;
	int bit_pos;
	unsigned char cur_byte;

	read_graph6_edges() : eos(true),
		num_nodes(0),
		packet_size(5),
		column(1),
		row(-1),
		bit_pos(-1),
		_in(0) {}

	~read_graph6_edges() {}

	read_graph6_edges(input_iterator& start) : 
		_in(&start), 
		eos(false),
		num_nodes(0),
		packet_size(5),
		column(1),
		row(-1),
		bit_pos(-1)  
	{
		parse_num_nodes();
		++*this;

	}

	void parse_num_nodes() {
		input_iterator& in = *_in;
		//Read the header
		if (*in=='>') { //We have the optional >>graph6<< header
			unsigned char h[] = ">>graph6<<";
			for(unsigned int i=0; i<(sizeof(h)/sizeof(unsigned char))-1; ++i) {
				if (h[i] != *in++) {
					throw std::invalid_argument(
						"The input is malformed. "
						"It seems to start with >>graph6<< but really doesn't."
						);
				}
			}
		}
		//now we're one past the optional header
		//parse the number of nodes
		if (*in < 63)
			throw std::invalid_argument("The number of nodes is not properly encoded");
		if (*in<126) {
			//6-bit encoding
			num_nodes = *in-63;
		} else if (*in++ == 126) {
			unsigned int packets = 3;
			if (*in == 126) {
				//36-bit encoding
				packets++;
				in++;
			}
			for(unsigned int i =0; i<packets*packet_size; ++i) {
				unsigned char packet = (*in++) - 63;
				if(packet>(1<<(packet_size+1))) {
					throw std::invalid_argument(
						"The input is malformed. "
						"It contains a non-printable ascii-char in the number of nodes encoding.");
				}
				num_nodes += packet;
				num_nodes *= (1<<packet_size);
			}
		} else {
			assert(*in>126);
			throw std::invalid_argument(
				"The input is malformed. "
				"The number of nodes is not correctly encoded, the first byte is >126."
				);
		}
		++in;
	}

	void next_edge() {
		unsigned int bit = 0;
		while(!bit && !eos) {
			if (++row==column) {
				column+=1;
				row = 0;
			}
			if (column>=num_nodes) {
				eos = true;
				break;
			}
			if (bit_pos<0) {
				if (**_in < 63 || **_in > 126) {
					throw std::invalid_argument(
						"The input contains a non-printable ascii char in the matrix encoding");
				}
				cur_byte = (*(*_in)) - 63;
				++(*_in);

				bit_pos = packet_size;
			}
			bit = cur_byte & (1<<(bit_pos--));
		}
	}

	const std::pair<int,int> operator*() const {
		return std::pair<int,int>(column,row);
	} 

	read_graph6_edges<input_iterator>& operator++() {
		next_edge();
		return *this;
	}

	read_graph6_edges<input_iterator> operator++(int) {
		read_graph6_edges<input_iterator> tmp = *this;
		++*this;
		return tmp;
	}

	bool operator==(read_graph6_edges<input_iterator>& other) {
		return (this->eos && other.eos) || (this->_in == other._in);
	}

	bool operator!=(read_graph6_edges<input_iterator>& other) {
		return !(*this==other);
	}

};

template<typename OutputIterator>
void write_n(OutputIterator& out, unsigned long n) {
	if (n<62) {
		out << ((unsigned char)(n+63));
		return;
	}

	out << ((unsigned char)126);
	int num_bytes = 2;
	if (n> 258047) {
		out << ((unsigned char)126);
		num_bytes = 3;
	}
	for(int byte=num_bytes; byte>=0; byte--) { 
		unsigned char c = 0;
		int n_pos = 6*(byte+1)-1;
		for(int c_pos=5; c_pos>=0; n_pos--, c_pos--) {
			c += (n & (1<<n_pos))>>((int)n_pos/6);
		}
		out << (c+63);
	}
		
}

/* Given an iterator over the adjacency matrix in the order (0,1),(0,2),(1,2),(0,3),(1,3),(2,3),...,(n-1,n)
   this writes a graph6 representation to out. */
template<typename OutputIterator, typename AdjacencyIterator>
void write_graph6(OutputIterator& out, unsigned long n, AdjacencyIterator start, AdjacencyIterator end) {
	write_n(out, n);

	unsigned char byte = 0;
	int byte_pos = 5;
	unsigned int bytes_written = 0;
	unsigned int col = 1;
	unsigned int row = 0;
	for(; start!=end; ++start) {
		// std::cout << "\t\n" << (int)byte << " " << byte_pos << std::endl;

		unsigned int bit = *start;
		byte = byte | (bit << byte_pos--);
		if (byte_pos < 0) {
			assert((byte+63) <= 126);
			out << (unsigned char)(byte+63);
			bytes_written++;
			byte = 0;
			byte_pos = 5;
		}
	}
	if (byte_pos!=5) {
		assert(byte+63 <= 126);
		out << (unsigned char)(byte+63);
		bytes_written++;
		byte=0;
	}
	assert(byte==0);
	assert (bytes_written== (int)ceil(n*(n-1)/12.0f));
	out << '\n';
}





#endif

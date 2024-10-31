#include <algorithm>
#include <cassert>
#include <chrono>
#include <iostream>
#include <numeric>
#include <ranges>
#include <string>
#include <vector>

using std::string;
using std::vector;
using std::chrono::steady_clock;

struct time_count {
  typedef decltype(steady_clock::now()) time;
  time prev;
  time_count() : prev(steady_clock::now()) {}
  double reset() {
    time prev_prev = prev;
    prev = steady_clock::now();
    return sub(prev, prev_prev);
  }
  double peek() const { return sub(steady_clock::now(), prev); }

 private:
  double sub(const time& a, const time& b) const {
    assert(a >= b);
    return std::chrono::duration<double>(a - b).count();
  }
};

enum Format {
  // lines with "u: v1 v2 v3 ..." where u is the vertex and v1, v2, v3, ... are
  // the neighbors. Vertices in 1..n. Each graph is separated from the next by
  // an empty line.
  ADJ_LIST,
  // u v on each line for each edge.
  EDGES,
  // Graph6 format
  GRAPH6,
};

struct graph {
 public:
  graph() {}
  graph(const graph& other) : adj(other.adj), m(other.m) {}
  // IO
  static void to_file(const vector<graph>& gs, const string& filename,
                      Format format);
  static vector<graph> from_file(const string& filename, Format format);
  void validate() const;
  // properties
  int degree(int u) const { return adj[u].size(); }
  int min_degree() const {
    return min_element(adj.begin(), adj.end(),
                       [](auto& a, auto& b) { return a.size() < b.size(); })
        ->size();
  }
  int max_degree() const {
    return max_element(adj.begin(), adj.end(),
                       [](auto& a, auto& b) { return a.size() < b.size(); })
        ->size();
  }
  int edge_count() const {
    assert(2 * m ==
           std::accumulate(adj.begin(), adj.end(), 0,
                           [](int a, auto& b) { return a + b.size(); }));
    return m;
  }
  int vertex_count() const { return adj.size(); }
  auto vertices(int start = 0) const {
    return std::ranges::views::iota(std::min<int>(start, adj.size()),
                                    (int)adj.size());
  }
  bool is_connected() const;
  bool is_acyclic() const;
  // Does the neighborhood of u induce an acyclic graph?
  bool has_acyclic_neighborhood(int u) const;
  bool has_cyclic_vx_neighborhood() const;
  bool has_cyclic_edge_neighborhood() const;
  // Is there any acyclic cut? Empty if not, or if already is disconnected.
  vector<int> forest_cut() const;
  vector<int> non_trivial_forest_cut() const;
  bool is_forest_cut(const vector<int>& vxs) const;
  bool is_3_connected() const;
  bool is_4_connected() const;
  bool has_universal_edge() const;
  // A forest cut removing each vertex
  bool has_strong_forest_cut() const;
  // subgraph induced by vxs
  graph induced_subgraph(const vector<int>& vxs) const;
  vector<int> vertices_complement(const vector<int>& vxs) const {
    vector<int> ans;
    // Can be improved with two pointers if needed.
    for (int u = 0; u < adj.size(); u++)
      if (!std::binary_search(vxs.begin(), vxs.end(), u)) ans.push_back(u);
    return ans;
  }
  vector<int> neighborhood(const vector<int>& vxs) const;

  // Simple graph operations
  // O(lg n)
  bool has_edge(int u, int v) const {
    if (u >= adj.size() || v >= adj.size()) return false;
    return std::binary_search(adj[u].begin(), adj[u].end(), v);
  }
  void add_edge(int u, int v, bool rev = true, bool sort = false) {
    while (adj.size() <= u || adj.size() <= v) adj.emplace_back();
    adj[u].push_back(v);
    if (u <= v || rev) m++;
    if (sort) std::sort(adj[u].begin(), adj[u].end());
    if (rev) adj[v].push_back(u);
    if (rev && sort) std::sort(adj[v].begin(), adj[v].end());
  }
  void erase_edge(int u, int v) {
    assert(has_edge(u, v));
    auto it = std::lower_bound(adj[u].begin(), adj[u].end(), v);
    assert(it != adj[u].end() && *it == v);
    adj[u].erase(it);
    it = std::lower_bound(adj[v].begin(), adj[v].end(), u);
    assert(it != adj[v].end() && *it == u);
    adj[v].erase(it);
    m--;
  }

  bool operator==(const graph& other) const { return adj == other.adj; }
  bool operator!=(const graph& other) const { return !(*this == other); }

  void print_debug(bool edges = false) const;
  // vertices in 0..n-1
  vector<vector<int>> adj;
  // Stored for convenience
  int m = 0;
};
#include <algorithm>
#include <numeric>
#include <string>
#include <vector>

using std::string;
using std::vector;

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
  // IO
  static void to_file(const vector<graph>& gs, const string& filename,
                      Format format);
  static vector<graph> from_file(const string& filename, Format format);
  void validate() const;
  // properties
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
    return std::accumulate(adj.begin(), adj.end(), 0,
                           [](int a, auto& b) { return a + b.size(); }) /
           2;
  }
  int vertex_count() const { return adj.size(); }
  bool is_connected() const;
  bool is_acyclic() const;
  // Does the neighborhood of u induce an acyclic graph?
  bool has_acyclic_neighborhood(int u) const;
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

  // Simple graph operations
  // O(lg n)
  bool exists_edge(int u, int v) const {
    return std::binary_search(adj[u].begin(), adj[u].end(), v);
  }
  void add_edge(int u, int v, bool rev = true) {
    while (adj.size() <= u || adj.size() <= v) adj.emplace_back();
    adj[u].push_back(v);
    if (rev) adj[v].push_back(u);
  }

  void print_debug(bool edges = false) const;
  // vertices in 0..n-1
  vector<vector<int>> adj;
};
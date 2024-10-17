#include "graph.h"

#include <cassert>
#include <fstream>
#include <iostream>
#include <map>
#include <set>
#include <sstream>

#include "graph6.hpp"

#define debug(...) (void)0
// #define debug(...) printf(__VA_ARGS__)
//  Remove assert if we trust the code
#undef assert
#define assert(...) (void)0

// A macro that prints the text of the expression and the bool value of it.
// #define DEB(expr)                                     \
//  ([&]() {                                            \
//    auto _val = (expr);                               \
//    std::cout << #expr << " = " << _val << std::endl; \
//    return _val;                                      \
//  }())
#define DEB(expr) (expr)

bool quick_disconsider(const graph& g) {
  int n = g.vertex_count();
  int m = g.edge_count();
  if (n < 3 || m >= 3 * n - 6) return true;
  if (!g.is_connected()) return true;
  // if (g.min_degree() < 4 || g.max_degree() < 5) return true;
  return false;
}

struct graph6_reader_iterator
    : public std::iterator<std::input_iterator_tag, graph> {
  using iterator_category = std::input_iterator_tag;
  using value_type = graph;
  using pointer = graph*;
  using reference = graph&;
  using difference_type = std::ptrdiff_t;

  graph g;
  std::istream_iterator<unsigned char> itt;
  graph6_reader_iterator() {}
  graph6_reader_iterator(std::istream_iterator<unsigned char> itt_)
      : itt(itt_) {
    read();
  }

  graph6_reader_iterator& operator++() {
    read();
    return *this;
  }
  void operator++(int) { read(); }
  void read() {
    g = graph();
    if (itt == std::istream_iterator<unsigned char>()) return;
    read_graph6_edges it(itt);
    for (; !it.eos; ++it) {
      auto [u, v] = *it;
      assert(u >= v);
      g.add_edge(u, v, true);
    }
    g.validate();
  }

  graph operator*() { return graph(g); }

  bool operator!=(const graph6_reader_iterator& other) const {
    return g != other.g || itt != other.itt;
  }
  bool operator==(const graph6_reader_iterator& other) const {
    return g == other.g && itt == other.itt;
  }
};

struct graph6_reader_iterable {
  std::istream& infile;
  graph6_reader_iterable(std::istream& infile_) : infile(infile_) {}
  graph6_reader_iterator begin() {
    return graph6_reader_iterator(std::istream_iterator<unsigned char>(infile));
  }
  graph6_reader_iterator end() { return graph6_reader_iterator(); }
  /*auto to_view() {
    auto it = begin();
    auto last = end();
    return views::repeat(0) | views::transform([=](int) mutable {
             if (it == last) return graph();
             graph g = *it;
             ++it;
             return g;
           });
  }*/
};

vector<graph> graph::from_file(std::istream& infile, Format format) {
  vector<graph> gs;
  if (format == Format::EDGES) {
    graph g;
    std::map<int, int> vertex_map;
    int vertex_counter = 0;
    int u, v;
    while (infile >> u >> v) {
      if (vertex_map.find(u) == vertex_map.end())
        vertex_map[u] = vertex_counter++;
      if (vertex_map.find(v) == vertex_map.end())
        vertex_map[v] = vertex_counter++;
      if (!g.has_edge(vertex_map[u], vertex_map[v]))
        g.add_edge(vertex_map[u], vertex_map[v], true, false);
    }
    g.mapping.resize(g.adj.size());
    for (auto [u, v] : vertex_map) g.mapping[v] = u;
    for (int i = 0; i < vertex_counter; i++)
      std::sort(g.adj[i].begin(), g.adj[i].end());
    gs.push_back(g);
  } else if (format == ADJ_LIST) {
    string line;
    int u, v;
    char sep;
    while (true) {
      while (std::getline(infile, line) && line.empty());
      if (line.empty()) break;
      int one_index = 1;
      graph g;
      do {
        assert(!infile.eof());
        debug("line %s\n", line.c_str());
        std::istringstream iss(line);
        iss >> std::ws >> u;
        // Sometimes the graphs are divided by a line with the vertices count
        if (iss.peek() <= 0) {
          if (g.vertex_count() == 0) {
            g.adj.resize(u + 1);
            continue;
          } else
            break;
        }
        iss >> std::ws >> sep;
        assert(sep == ':');
        if (u == 0) one_index = 0;
        u -= one_index;
        assert(u >= 0);
        while (iss >> std::ws >> v) {
          v -= one_index;
          assert(v >= 0);
          g.add_edge(u, v, false);
        }
      } while (std::getline(infile, line) && !line.empty());
      if (!quick_disconsider(g)) gs.emplace_back(g);
      // gs.emplace_back(g);
    }
  } else if (format == Format::GRAPH6) {
    std::istream_iterator<unsigned char> iit(infile), eos;
    while (iit != eos) {
      read_graph6_edges it(iit);
      graph g;
      for (; !it.eos; ++it) {
        auto [u, v] = *it;
        assert(u >= v);
        g.add_edge(u, v, true);
      }
      gs.emplace_back(g);
    }
  } else
    throw "Unknown input format";
  for (auto& g : gs) {
    g.validate();
  }
  return gs;
}

void graph::to_file(const vector<graph>& gs, const string& filename,
                    Format format) {
  std::ofstream outfile(filename);
  if (format == ADJ_LIST) {
    for (const graph& g : gs) {
      for (int u = 0; u < g.adj.size(); u++) {
        outfile << u + 1 << ":";
        for (int v : g.adj[u]) outfile << " " << v + 1;
        outfile << "\n";
      }
      outfile << "\n";
    }
  } else if (format == EDGES) {
    for (const graph& g : gs) {
      for (int u = 0; u < g.adj.size(); u++) {
        for (int v : g.adj[u]) outfile << u + 1 << " " << v + 1 << "\n";
      }
      outfile << "\n";
    }

  } else
    throw "Unknown output format";
}

void graph::validate() const {
  for (int u = 0; u < adj.size(); u++)
    assert(is_sorted(adj[u].begin(), adj[u].end()));
  for (int u = 0; u < adj.size(); u++) {
    for (int j = 0; j < adj[u].size(); j++) {
      assert(j == 0 || adj[u][j - 1] != adj[u][j]);
      assert(0 <= adj[u][j] && adj[u][j] < adj.size());
      assert(has_edge(adj[u][j], u));
    }
  }
}

namespace {
inline int find_idx(const vector<int>& sorted_arr, int v) {
  auto it = std::lower_bound(sorted_arr.begin(), sorted_arr.end(), v);
  if (it == sorted_arr.end() || *it != v) return -1;
  return it - sorted_arr.begin();
}
}  // namespace

graph graph::induced_subgraph(const vector<int>& vxs) const {
  assert(std::is_sorted(vxs.begin(), vxs.end()));
  graph g2;
  g2.adj.resize(vxs.size());
  for (int ui = 0; ui < vxs.size(); ui++) {
    int u = vxs[ui];
    for (int v : adj[u]) {
      int vi = find_idx(vxs, v);
      if (vi != -1) {
        g2.add_edge(ui, vi, false);
      }
    }
  }
  g2.validate();
  return g2;
}

bool graph::is_connected() const {
  vector<bool> visited(adj.size());
  vector<int> stack;
  stack.push_back(0);
  visited[0] = true;
  while (!stack.empty()) {
    int u = stack.back();
    stack.pop_back();
    for (int v : adj[u]) {
      if (!visited[v]) {
        visited[v] = true;
        stack.push_back(v);
      }
    }
  }
  return std::all_of(visited.begin(), visited.end(), [](bool b) { return b; });
}

void graph::print_debug(bool edges) const {
  if (edges) {
    for (int u = 0; u < adj.size(); u++)
      for (int v : adj[u])
        if (v > u) printf("%d %d\n", user_friendly(u), user_friendly(v));
    return;
  }

  for (int u = 0; u < adj.size(); u++) {
    printf("%d:", user_friendly(u));
    for (int v : adj[u]) printf(" %d", user_friendly(v));
    printf("\n");
  }
  printf("----\n");
}

bool graph::is_acyclic() const {
  vector<int> in_degree(adj.size());
  vector<int> stack;
  vector<bool> visited(vertex_count(), false);
  for (int u = 0; u < adj.size(); u++) {
    in_degree[u] = adj[u].size();
    if (in_degree[u] <= 1) stack.push_back(u), visited[u] = true;
  }
  while (!stack.empty()) {
    int u = stack.back();
    stack.pop_back();
    for (int v : adj[u]) {
      in_degree[v]--;
      if (in_degree[v] <= 1 && !visited[v])
        stack.push_back(v), visited[v] = true;
    }
  }
  return std::all_of(in_degree.begin(), in_degree.end(),
                     [](int d) { return d == 0; });
}

bool graph::has_acyclic_neighborhood(int u) const {
  return induced_subgraph(adj[u]).is_acyclic();
}

struct forest_cut_builder {
 public:
  // Finds a forest cut in the graph.
  static vector<int> brute(const graph& g, int vertex_to_exclude = -1) {
    forest_cut_builder fc = {g, vector<int>(), vertex_to_exclude};
    return fc(0) ? fc.cut_so_far : vector<int>();
  }

  const graph& g;
  vector<int> cut_so_far;
  int vertex_to_exclude;
  // Invariant: cut_so_far is acyclic but it's not a cut, and we can't add vxs <
  // next_u_to_add to it. All vxs in the cut have >= 2 edges to outside the cut
  // (otherwise it wouldn't be minimal).
  bool operator()(int next_u_to_add) {
    if (next_u_to_add == g.vertex_count()) return false;
    if (next_u_to_add == vertex_to_exclude) return (*this)(next_u_to_add + 1);
    cut_so_far.push_back(next_u_to_add);
    if (g.induced_subgraph(cut_so_far).is_acyclic()) {
      // We found a forest-cut! Idc if it's actually minimal.
      if (!g.induced_subgraph(g.vertices_complement(cut_so_far)).is_connected())
        return true;
      int u;
      for (u = 0; u < cut_so_far.size(); u++) {
        if (g.degree(cut_so_far[u]) >= cut_so_far.size() - 1 + 2) continue;
        vector<int> adj_outside_cut;
        std::set_difference(g.adj[cut_so_far[u]].begin(),
                            g.adj[cut_so_far[u]].end(), cut_so_far.begin(),
                            cut_so_far.end(),
                            std::back_inserter(adj_outside_cut));
        if (adj_outside_cut.size() < 2) break;
      }
      bool can_be_minimal = u == cut_so_far.size();
      if (can_be_minimal && (*this)(next_u_to_add + 1)) return true;
    }
    cut_so_far.pop_back();
    return (*this)(next_u_to_add + 1);
  }
};

vector<int> graph::forest_cut() const {
  for (int u = 0; u < adj.size(); u++)
    if (adj[u].size() < vertex_count() - 1 && has_acyclic_neighborhood(u)) {
      debug("Using neighborhood of %d\n", u + 1);
      return vector(adj[u]);
    }
  for (int u = 0; u < adj.size(); u++)
    if (adj[u].size() == vertex_count() - 1) {
      // Possible to build using the < 2n - 3 independent set bound, but let's
      // not do it now bc it might be hard.
      debug("Using independent set theorem.\n");
      return {-1};
    }
  if (max_degree() < 5 || min_degree() < 4 || !is_4_connected()) {
    debug("Not 4 connected or small degrees.\n");
    return {-2};
  }
  time_count tc;
  vector<int> ans = forest_cut_builder::brute(*this);
  if (tc.peek() > 0.05)
    debug("(%.2fs) Had to brute force for a forest cut.\n", tc.peek());
  if (!ans.empty()) assert(is_forest_cut(ans));
  return ans;
}

vector<int> graph::non_trivial_forest_cut() const {
  for (int u = 0; u < adj.size(); u++)
    if (adj[u].size() < vertex_count() - 1 && has_acyclic_neighborhood(u))
      return {};
  for (int u = 0; u < adj.size(); u++)
    if (adj[u].size() == vertex_count() - 1) {
      // Possible to build using the < 2n - 3 independent set bound, but let's
      // not do it now bc it might be hard.
      return {};
    }
  time_count tc;
  vector<int> ans = forest_cut_builder::brute(*this);
  if (tc.peek() > 0.05)
    debug("(%.2fs) Had to brute force for a forest cut.\n", tc.peek());
  if (!ans.empty()) assert(is_forest_cut(ans));
  return ans;
}

bool graph::is_forest_cut(const vector<int>& vxs) const {
  return DEB(is_connected()) & DEB(induced_subgraph(vxs).is_acyclic()) &
         DEB(!induced_subgraph(vertices_complement(vxs)).is_connected());
}

bool graph::is_3_connected() const {
  int n = vertex_count();
  if (n < 3) return false;
  for (int u = 0; u < n; u++)
    for (int v = u + 1; v < n; v++)
      if (!induced_subgraph(vertices_complement({u, v})).is_connected())
        return false;
  return true;
}

bool graph::is_4_connected() const {
  int n = vertex_count();
  if (n < 4) return false;
  for (int u = 0; u < n; u++)
    for (int v = u + 1; v < n; v++)
      for (int w = v + 1; w < n; w++)
        if (!induced_subgraph(vertices_complement({u, v, w})).is_connected())
          return false;
  return true;
}

vector<int> graph::neighborhood(const vector<int>& vxs) const {
  vector<int> all, ans;
  for (int u : vxs) all.insert(all.end(), adj[u].begin(), adj[u].end());
  std::sort(all.begin(), all.end());
  std::set_difference(all.begin(), all.end(), vxs.begin(), vxs.end(),
                      std::back_inserter(ans));
  return ans;
}

// A forest cut removing each vertex
bool graph::has_strong_forest_cut() const {
  vector<int> cut_so_far;
  std::set<int> forest_cut_without_u;
  vector<int> cut = forest_cut_builder::brute(*this);
  if (cut.empty()) return false;
  for (int u : vertices_complement(cut)) forest_cut_without_u.insert(u);
  int n = vertex_count();
  for (int u = 0; u < n; u++) {
    if (forest_cut_without_u.count(u) == 0) {
      cut_so_far.clear();
      cut = forest_cut_builder::brute(*this, u);
      if (cut.empty()) {
        printf("No cut for vertex %d\n", u + 1);
        return false;
      }
      for (int v : vertices_complement(cut)) forest_cut_without_u.insert(v);
    }
    assert(forest_cut_without_u.count(u) > 0);
  }
  return forest_cut_without_u.size() == n;
}

bool graph::has_universal_edge() const {
  int n = vertex_count();
  for (int u = 0; u < n; u++)
    for (int v : adj[u]) {
      if (v < u || adj[u].size() + adj[v].size() < n) continue;
      vector<int> all_adj(adj[u]);
      all_adj.insert(all_adj.end(), adj[v].begin(), adj[v].end());
      std::sort(all_adj.begin(), all_adj.end());
      if (std::unique(all_adj.begin(), all_adj.end()) - all_adj.begin() == n)
        return true;
    }
  return false;
}
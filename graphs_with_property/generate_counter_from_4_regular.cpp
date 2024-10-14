#include <cstdio>
#include <ctime>
#include <ranges>

// Fuck it, include cpp
#include "graph.cpp"

using namespace std::ranges;

// input file
const string input_filename = "input.g6";

bool add_triangle_to_induced(graph &g, const vector<int> &vxs) {
  int vn = vxs.size();
  graph h = g.induced_subgraph(vxs);
  if (!h.is_acyclic()) return true;
  int tr[3] = {-1, -1, -1};
  int max_deg = h.max_degree();
  if (max_deg == 0)
    tr[0] = vxs[rand() % vn];
  else if (max_deg == 1) {
    vector<int> all_1;
    for (int u = 0; u < vn; u++)
      if (h.degree(u) == 1) all_1.push_back(u);
    tr[0] = all_1[rand() % all_1.size()];
    tr[1] = h.adj[tr[0]][0];
  } else {  // if (max_deg >= 2) {
    vector<int> all_2p;
    for (int u = 0; u < vn; u++)
      if (h.degree(u) >= 2) all_2p.push_back(u);
    tr[0] = all_2p[rand() % all_2p.size()];
    tr[1] = h.adj[tr[0]][rand() % h.degree(tr[0])];
    while (tr[2] == -1)
      if (int v = h.adj[tr[0]][rand() % h.degree(tr[0])]; v != tr[1]) tr[2] = v;
  }
  // Could be done without a possible infinite loop, but the expected time is
  // like at most 5 iterations, so fuck it. Same for above.
  while (tr[2] == -1) {
    int v = vxs[rand() % vn];
    if (tr[1] == -1 && v != tr[0])
      tr[1] = v;
    else if (tr[2] == -1 && v != tr[0] && v != tr[1])
      tr[2] = v;
  }
  for (int u = 0; u < 2; u++)
    for (int v = u + 1; v < 3; v++)
      if (!g.has_edge(vxs[u], vxs[v])) g.add_edge(vxs[u], vxs[v], true, true);
  return true;
}

graph increment_graph(graph &orig) {
  int n = orig.vertex_count(), u;
  int max_m = 3 * n - 7;
  // Try some times to generate the graph.
  for (int t = 0; t < 2; t++) {
    graph g = orig;
    for (u = 0; u < n; u++)
      if (!add_triangle_to_induced(g, g.adj[u]) || g.edge_count() > max_m)
        break;
    if (u < n || g.edge_count() > max_m) continue;
    debug("With cycles in all adj: n=%d m=%d >? %d\n", n, g.edge_count(),
          max_m);
    while (g.edge_count() < max_m) {
      vector<int> cut = g.non_trivial_forest_cut();
      if (cut.empty() || !add_triangle_to_induced(g, cut) ||
          g.edge_count() > max_m)
        break;
    }
    while (g.edge_count() < max_m) {
      int u = rand() % n, v = rand() % n;
      if (u != v && !g.has_edge(u, v)) g.add_edge(u, v, true, true);
    }
    g.validate();
    return g;
  }
  return graph();
}

void check_all(auto graphs) {
  time_count t;
  bool any = false;

  int i = 0;
  int tot = 0;
  for (graph g : graphs) {
    if (g.vertex_count() == 0) break;
    tot++;
    if (g.min_degree() < 3 || !g.is_connected()) {
      printf(" Should start from a proper graph\n");
      continue;
    }
    g = increment_graph(g);
    if (g.vertex_count() == 0 || quick_disconsider(g)) continue;
    if (t.peek() >= 30)
      printf(
          "Testing graph %d (n=%d m=%d) (out of %d generated) after %ds...\n",
          i + 1, g.vertex_count(), g.edge_count(), tot, t.reset());
    vector<int> cut = g.forest_cut();
    if (cut.empty()) {
      any = true;
      printf(
          ">>>>> Graph %d has no forest cut, with %d vertices and %d < %d "
          "edges.\n",
          i + 1, g.vertex_count(), g.edge_count(), 3 * g.vertex_count() - 6);
      g.print_debug(true);
      printf("===================\n\n");
    } else {
      if (cut[0] >= 0) assert(g.is_forest_cut(cut));
    }
    i++;
  }
  printf("Checked all %d graphs (out of %d).", i, tot);
  if (!any) printf(" No counterexample found.\n");
}

void blowup_vertex(graph &g, int u) {
  assert(g.degree(u) >= 3);
  int n = g.vertex_count();
  // u will become a K4 with u, n, n + 1, n + 2
  int k4v[4] = {n, n + 1, n + 2, u};
  // Move edges from u to the remaining of the new K4
  for (int i = 0; i < 3; i++) {
    if (g.degree(1) == 1) continue;
    int v = g.adj[u].back();
    g.erase_edge(u, v);
    g.add_edge(k4v[i], v);
  }
  for (int i = 0; i < 4; i++)
    for (int j = i + 1; j < 4; j++) g.add_edge(k4v[i], k4v[j], true, false);
  for (int i = 0; i < 3; i++) std::ranges::sort(g.adj[k4v[i]]);
}

// Generates graphs by starting with a regular graph and blowing up each
// vertices into a K4, this generates graphs where each neighborhood has
// a triangle. If they were 3-regular, they now have 15n/8 < 2n edges, if they
// were 4-regular, they now have 2n edges.
auto reg_blowup_generator(auto graphs_reg) {
  return graphs_reg | views::transform([](graph g) -> graph {
           if (g.vertex_count() == 0) return g;
           assert(g.vertex_count() > 0);
           int on = g.vertex_count();
           for (int u = 0; u < on; u++) blowup_vertex(g, u);
           g.validate();
           // by construction
           for (int u = 0; u < g.vertex_count(); u++) {
             if (g.has_acyclic_neighborhood(u)) g.print_debug(true);
             assert(!g.has_acyclic_neighborhood(u));
           }
           return g;
         });
}

const bool USE_STDIN = false;

int main() {
  printf("Starting.\n");
  srand(time(NULL));
  if (USE_STDIN)
    check_all(graph6_reader_iterable(std::cin));
  else
    check_all(reg_blowup_generator(graph6_reader_iterable(std::cin).to_view()));
}
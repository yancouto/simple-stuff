#include <cstdio>
#include <ctime>
#include <functional>
#include <optional>
#include <ranges>
#include <utility>

// Fuck it, include cpp
#include "graph.cpp"

using namespace std::ranges;
using std::optional;
using std::pair;

// input file
const string input_filename = "input.g6";

bool add_triangle_to_induced(graph &g, const vector<int> &vxs) {
  int vn = vxs.size();
  assert(vn >= 3);
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
      if (cut.size() < 3 || !add_triangle_to_induced(g, cut)) break;
    }
    debug("With cycles in most neighborhoods: n=%d m=%d >? %d\n", n,
          g.edge_count(), max_m);
    // We shouldn't really get here in most situations, but let's just add some
    // random edges...
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
  time_count t, total_time;
  bool any = false;

  int i = 0;
  int tot = 0;
  for (graph g : graphs) {
    if (g.vertex_count() == 0) break;
    tot++;
    debug("[%.1fs] Checking graph %d\n", total_time.peek(), tot);
    if (g.min_degree() < 3 || !g.is_connected()) {
      printf(" Should start from a proper graph\n");
      continue;
    }
    g = increment_graph(g);
    debug("Incremented graph %d\n", tot);
    if (g.vertex_count() == 0 || quick_disconsider(g)) continue;
    i++;
    debug("Graph %d is the %d-th good incremented graph.\n", tot, i);
    if (t.peek() >= 30)
      printf(
          "Testing graph %d (n=%d m=%d) (out of %d generated) after %.1fs...\n",
          i, g.vertex_count(), g.edge_count(), tot, total_time.peek()),
          t.reset();
    vector<int> cut = g.forest_cut();
    if (cut.empty()) {
      any = true;
      printf(
          ">>>>> Graph %d has no forest cut, with %d vertices and %d < %d "
          "edges.\n",
          i, g.vertex_count(), g.edge_count(), 3 * g.vertex_count() - 6);
      g.print_debug(true);
      printf("===================\n\n");
    } else {
      if (cut[0] >= 0) assert(g.is_forest_cut(cut));
    }
  }
  printf("[%.1fs] Checked all %d graphs (out of %d).", total_time.peek(), i,
         tot);
  if (!any) printf(" No counterexample found.\n");
}

void blowup_vertex(graph &g, int u, int k) {
  int initial_degree = g.degree(u);
  // not really necessary for this to work, but the graph will be weak otherwise
  assert(initial_degree >= 3);
  int n = g.vertex_count();
  // u will become a K_k with u, n, n + 1, .., n + k - 2
  vector<int> kkv{u};
  for (int i = 0; i < k - 1; i++) kkv.push_back(n + i);
  // Move edges from u to the remaining of the new K_k, distribute them as
  // evenly as possible
  for (int i = 0; i < initial_degree; i++) {
    int to = kkv[i % k];
    if (to == u) continue;
    int v = g.adj[u].back();
    g.erase_edge(u, v);
    g.add_edge(to, v);
  }
  for (int i = 0; i < k; i++)
    for (int j = i + 1; j < k; j++) g.add_edge(kkv[i], kkv[j], true, false);
  for (int i = 0; i < k; i++) std::ranges::sort(g.adj[kkv[i]]);
}

// Generates graphs by starting with a regular graph and blowing up each
// vertices into a K_k, k >= 3. For K4, this generates graphs where each
// neighborhood has a triangle. If they were 3-regular, they now have 15n/8 < 2n
// edges, if they were 4-regular, they now have 2n edges.
auto reg_blowup_generator(auto graphs_reg, vector<vector<int>> kks) {
  return graphs_reg |
         views::transform([=](graph orig) -> vector<pair<graph, vector<int>>> {
           if (orig.vertex_count() > 0 && !orig.is_4_connected()) return {};
           vector<pair<graph, vector<int>>> ret;
           for (auto &ks : kks) ret.emplace_back(orig, vector(ks));
           return ret;
         }) |
         views::join | views::transform([](auto val) -> vector<graph> {
           auto [g, ks] = val;
           if (g.vertex_count() == 0) return {g};
           time_count t;
           debug("Applying blowups\n");
           for (int k : ks) {
             debug("[%.2fs] Applying blowup %d\n", t.peek(), k);
             if (k == 1) continue;
             int on = g.vertex_count();
             if (g.edge_count() + on * (k * (k - 1)) / 2 >= 3 * (k * on) - 6) {
               debug("Skipping blowup %d\n", k);
               return {};
             }
             for (int u = 0; u < on; u++) blowup_vertex(g, u, k);
             debug("[%.2fs] Blowup %d done\n", t.peek(), k);
             // by construction
             assert(g.is_4_connected());
             debug("[%.2fs] Construction checks done\n", t.peek());
             if (k >= 4)
               for (int u : g.vertices())
                 assert(!g.has_acyclic_neighborhood(u));
             debug("[%.2fs] Construction checks done\n", t.peek());
             if (k >= 5)
               for (int u : g.vertices())
                 for (int v : g.vertices(u + 1))
                   assert(g.induced_subgraph(g.vertices_complement({u, v}))
                              .is_connected());
             debug("[%.2fs] Construction checks done\n", t.peek());
           }
           debug("[total = %.2fs] Validating\n", t.peek());
           g.validate();
           return {g};
         }) |
         views::join;
}

const bool BLOWUP = true;

int main() {
  printf("Starting.\n");
  srand(time(NULL));
  if (!BLOWUP)
    check_all(graph6_reader_iterable(std::cin));
  else
    check_all(reg_blowup_generator(graph6_reader_iterable(std::cin).to_view(),
                                   {{1}, {4}, {5}, {6}}));
}
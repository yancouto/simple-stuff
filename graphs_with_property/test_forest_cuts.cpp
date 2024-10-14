#include <cstdio>
#include <ctime>

// Fuck it, include cpp
#include "graph.cpp"

// input file
const string input_filename = "input.g6";
const bool FIND_TRIVIAL = false;
const bool FIND_INDUCTION = false;

int main() {
  printf("Starting.\n");
  time_count t;
  // std::ifstream infile(input_filename);
  auto graphs = graph6_reader_iterable(std::cin);
  // vector<int> graphs = {test_graph_1()};
  int ith_trivial = 2;  // 1-index

  // graph::to_file(graphs, "out.txt", Format::ADJ_LIST);
  int i = 0;
  for (graph g : graphs) {
    if (t.peek() >= 15)
      printf("Testing graph %d (n=%d m=%d) after %ds...\n", i + 1,
             g.vertex_count(), g.edge_count(), t.reset());
    debug("Testing graph %d...\n", i + 1);
    if (quick_disconsider(g))
      debug("Graph %d disconsidered! You might want to remove those.\n", i + 1);
    else {
      if (FIND_INDUCTION) {
        if (g.is_3_connected() && g.max_degree() < g.vertex_count() - 1 &&
            !g.has_strong_forest_cut()) {
          printf("Graph %d is a counterexample.\n", i + 1);
          g.print_debug(true);
          return 0;
        }
      }
      vector<int> cut;
      if (FIND_TRIVIAL)
        cut = g.non_trivial_forest_cut();
      else
        cut = g.forest_cut();
      if (cut.empty()) {
        if (FIND_TRIVIAL) continue;
        printf(
            ">>>>> Graph %d has no forest cut, with %d vertices and %d < %d "
            "edges.\n",
            i + 1, g.vertex_count(), g.edge_count(), 3 * g.vertex_count() - 6);
        g.print_debug(true);
        printf("===================\n\n");
      } else if (cut[0] == -1) {
        debug("We believed the conjecture about universal vertex.\n");
      } else {
        if (cut[0] >= 0) assert(g.is_forest_cut(cut));
        if (FIND_TRIVIAL) {
          if (--ith_trivial) continue;
          graph::to_file({g}, "example.txt", Format::EDGES);
          printf("Cut is:");
          for (int u : cut) printf(" %d", u + 1);
          putchar('\n');
          return 0;
        }
      }
    }
    i++;
  }
  printf("Checked all %d graphs.", i);
  if (FIND_INDUCTION) printf(" No induction counterexample found.\n");
}
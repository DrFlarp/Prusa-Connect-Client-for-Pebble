#include <pebble.h>

int main(void) {
  Window *w = window_create();
  window_stack_push(w, true);

  ModdableCreationRecord cr = {
    .recordSize = sizeof(cr),
    .stack = 8192,
    .slot = 36864,
    .chunk = 24576,
    .flags = kModdableCreationFlagLogInstrumentation,
  };
  moddable_createMachine(&cr);

  window_destroy(w);
}

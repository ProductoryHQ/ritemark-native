#include <stdio.h>
#include <unistd.h>

int main(int argc, char **argv) {
    if (argc != 2) return 2;
    FILE *marker = fopen(argv[1], "w");
    if (marker == NULL) return 1;
    fprintf(marker, "%d\n", getpid());
    if (fclose(marker) != 0) return 1;
    // Stay alive while LaunchServices discovers the embedded extensions.
    sleep(5);
    return 0;
}

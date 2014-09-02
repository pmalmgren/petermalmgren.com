module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    replace: {
      dist: {
        options: {
          patterns: [
            {
              match: 'include-header',
              replacement: '<%= grunt.file.read("_src/dist/include-header.html") %>'
            },
            {
              match: 'include-body',
              replacement: '<%= grunt.file.read("_src/dist/include-body.html") %>'
            }
          ]
        },
        files: [
          {expand: false, flatten: true, src: ['_src/default.html'], dest: '_layouts/default.html'}
        ]
      },

      dev: {
        options: {
          patterns: [
            {
              match: 'include-header',
              replacement: '<%= grunt.file.read("_src/dev/include-header.html") %>'
            },
            {
              match: 'include-body',
              replacement: '<%= grunt.file.read("_src/dev/include-body.html") %>'
            }
          ]
        },
        files: [
          {expand: false, flatten: true, src: ['_src/default.html'], dest: '_layouts/default.html'}
        ]
      }
    },

    copy: {
      dist: {
        files: [
          // includes files within path
          {
            expand: true, 
            flatten: true,
            src: ['bower_components/jquery/dist/jquery.min.js',
                  'bower_components/modernizr/modernizr.js',
                  'bower_components/foundation/js/foundation.min.js'], 
            dest: 'js/', 
            filter: 'isFile'
          },
        ]
      },
      dev: {
        files: [
          {
            expand: true, 
            flatten: true,
            src: ['bower_components/jquery/dist/jquery.js',
                  'bower_components/modernizr/modernizr.js',
                  'bower_components/foundation/js/foundation.js'], 
            dest: 'js/', 
            filter: 'isFile'
          }
        ]
      }
    },

    sass: {
      options: {
        includePaths: ['bower_components/foundation/scss']
      },
      dist: {
        options: {
          outputStyle: 'compressed'
        },
        files: {
          'css/app.css': 'scss/app.scss'
        }        
      }
    },

    exec: {
      build_jekyll: 'jekyll build'
    },

    watch: {
      grunt: { files: ['Gruntfile.js'] },

      sass: {
        files: 'scss/**/*.scss',
        tasks: ['sass']
      },
      layouts: {
        files: '_layouts/**/*.html',
        tasks: ['exec']
      },
      source: {
        files: '_src/**/*.html',
        tasks: ['replace:dev','exec']
      }
    }
  });

  grunt.loadNpmTasks('grunt-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-replace');

  grunt.registerTask('build-dist', ['sass','copy:dist','replace:dist','exec']);
  grunt.registerTask('build-dev', ['sass','copy:dev','replace:dev','exec']);
  grunt.registerTask('default', ['build-dev','watch']);
}

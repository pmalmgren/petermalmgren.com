module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

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

    bowercopy: {
      options: {
        clean: false
      },

      css: {
        options: {
          destPrefix: 'css/'
        },
        files: {
          'font-awesome.css': 'font-awesome/css/font-awesome.min.css',
          'default.css': 'highlight/src/styles/solarized_light.css'
        }
      },

      js: {
        options: {
          destPrefix: 'js/'
        },
        files: {
          'highlight.pack.js': 'highlight/build/highlight.pack.js'
        }
      }
    },

    watch: {
      sass: {
        files: 'scss/**/*.scss',
        tasks: ['sass','exec']
      }
    }
  });

  grunt.loadNpmTasks('grunt-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-bowercopy');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-replace');

  grunt.registerTask('build-dist', ['sass','exec']);
  grunt.registerTask('build-dev', ['sass','exec']);
  grunt.registerTask('default', ['build-dev','watch']);
}

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    sass: {
      options: {
        includePaths: ['bower_components/foundation/scss']
      },
      dist: {
        options: {
          outputStyle: 'nested'
        },
        files: {
          'dist/custom.css': 'scss/app.scss'
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
          destPrefix: 'dist/'
        },
        files: {
          'default.css': 'highlight/src/styles/solarized_light.css'
        }
      },

      js: {
        options: {
          destPrefix: 'dist/'
        },
        files: {
          'highlight.pack.js': 'highlight/build/highlight.pack.js',
          'retina.min.js': 'retinajs/dist/retina.min.js'
        }
      }
    },

    concat: {
      options: { 
        separator: ';',
      },
      dist: {
        src: ['dist/highlight.pack.js','dist/retina.min.js'],
        dest: 'js/app.js'
      }
    },

    concat_css: {
      options: {},
      all: {
        src: ['dist/default.css','dist/custom.css'],
        dest: 'dist/app.css'
      },
    },

    cssmin: {
      target: {
        files: [{
          expand: false,
          src: ['dist/app.css'],
          dest: 'css/app.min.css',
          ext: '.min.css'
        }]
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
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-concat-css');
  grunt.loadNpmTasks('grunt-replace');

  grunt.registerTask('build', ['bowercopy','sass','concat','concat_css','cssmin','exec']);
  grunt.registerTask('default', ['exec','sass','watch']);
}

var autoprefixer = require('autoprefixer');
var cssnano = require('cssnano');
var loadGruntTasks = require('load-grunt-tasks');
var os = require('os');
var arch = os.arch();
if ( arch === 'x64' ) arch = 'amd64';

module.exports = function (grunt) {

  loadGruntTasks(grunt, {
    pattern: ['grunt-*', 'gruntify-*']
  });

  grunt.registerTask('default', ['eslint', 'build']);
  grunt.registerTask('before-copy', [
    'vendor:',
    'html2js',
    'useminPrepare:release',
    'concat',
    'postcss:build',
    'clean:tmpl',
    'replace',
    'uglify'
  ]);
  grunt.registerTask('after-copy', [
    'filerev',
    'usemin',
    'clean:tmp'
  ]);
  grunt.registerTask('build-webapp', [
    'config:prod',
    'clean:all',
    'before-copy',
    'copy:assets',
    'after-copy'
  ]);
  grunt.registerTask('build', [
    'config:dev',
    'clean:app',
    'shell:buildBinary:linux:' + arch,
    'shell:downloadDockerBinary:linux:' + arch,
    'shell:extractDockerBinary:linux:' + arch,
    'vendor:regular',
    'html2js',
    'useminPrepare:dev',
    'concat',
    'clean:tmpl',
    'replace',
    'copy',
    'after-copy'
  ]);
  grunt.task.registerTask('release', 'release:<platform>:<arch>', function(p, a) {
    grunt.task.run(['config:prod', 'clean:all', 'shell:buildBinary:'+p+':'+a, 'shell:downloadDockerBinary:'+p+':'+a, 'shell:extractDockerBinary:'+p+':'+a, 'before-copy', 'copy:assets', 'after-copy']);
  });
  grunt.registerTask('lint', ['eslint']);
  grunt.registerTask('run-dev', ['build', 'shell:rm', 'shell:run', 'watch:build']);
  grunt.registerTask('clear', ['clean:app']);

  // Project configuration.
  grunt.initConfig({
    distdir: 'dist/public',
    dockerdir: './docker_binaries/',  // Must include trailing slash
    shippedDockerVersion: '17.09.0-ce',
    pkg: grunt.file.readJSON('package.json'),
    config: {
      dev:  { options: { variables: { 'environment': 'development' }}},
      prod: { options: { variables: { 'environment': 'production'  }}}
    },
    src: {
      js: ['app/**/__module.js', 'app/**/*.js', '!app/**/*.spec.js'],
      jsTpl: ['<%= distdir %>/templates/**/*.js'],
      html: ['index.html'],
      tpl: ['app/components/**/*.html', 'app/directives/**/*.html'],
      css: ['assets/css/app.css']
    },
    clean: {
      all: ['<%= distdir %>/../*'],
      app: ['<%= distdir %>/*'],
      tmpl: ['<%= distdir %>/templates'],
      tmp: ['<%= distdir %>/js/*', '!<%= distdir %>/js/app.*.js', '<%= distdir %>/css/*', '!<%= distdir %>/css/app.*.css']
    },
    useminPrepare: {
      dev: {
        src: '<%= src.html %>',
        options: {
          root: '<%= distdir %>',
          flow: {
            steps: {
              js: ['concat'],
              css: ['concat']
            }
          }
        }
      },
      release: {
        src: '<%= src.html %>',
        options: {
          root: '<%= distdir %>',
          dest: '<%= distdir %>'
        }
      }
    },
    filerev: { files: { src: ['<%= distdir %>/js/*.js', '<%= distdir %>/css/*.css'] }},
    usemin: { html: ['<%= distdir %>/index.html'] },
    copy: {
      bundle: {
        files: [
          {dest:'<%= distdir %>/js/',  src: ['app.js'],  expand: true, cwd: '.tmp/concat/js/' },
          {dest:'<%= distdir %>/css/', src: ['app.css'], expand: true, cwd: '.tmp/concat/css/' }
        ]
      },
      assets: {
        files: [
          {dest: '<%= distdir %>/fonts/',  src: '*.{ttf,woff,woff2,eof,svg}', expand: true, cwd: 'bower_components/bootstrap/fonts/'},
          {dest: '<%= distdir %>/fonts/',  src: '*.{ttf,woff,woff2,eof,svg}', expand: true, cwd: 'bower_components/font-awesome/fonts/'},
          {dest: '<%= distdir %>/fonts/',  src: '*.{ttf,woff,woff2,eof,svg}', expand: true, cwd: 'bower_components/rdash-ui/dist/fonts/'},
          {dest: '<%= distdir %>/images/', src: '**',                         expand: true, cwd: 'assets/images/'},
          {dest: '<%= distdir %>/ico',     src: '**',                         expand: true, cwd: 'assets/ico'}
        ]
      }
    },
    eslint: {
      src: ['gruntfile.js', '<%= src.js %>'],
      options: { configFile: '.eslintrc.yml' }
    },
    html2js: {
      app: {
        options: { base: '.' },
        src: ['<%= src.tpl %>'],
        dest: '<%= distdir %>/templates/app.js',
        module: '<%= pkg.name %>.templates'
      }
    },
    concat: {
      vendor: {
        files: {
          '<%= distdir %>/css/<%= pkg.name %>.css': ['<%= src.cssVendor %>', '<%= src.css %>'],
          '<%= distdir %>/js/vendor.js': ['<%= src.jsVendor %>'],
          '<%= distdir %>/js/angular.js': ['<%= src.angularVendor %>']
        }
      },
      dist: {
        options: { process: true },
        files: {
          '<%= distdir %>/js/<%= pkg.name %>.js': ['<%= src.js %>', '<%= src.jsTpl %>'],
          '<%= distdir %>/index.html': ['index.html']
        }
      }
    },
    uglify: {
      dist: {
        files: { '<%= distdir %>/js/<%= pkg.name %>.js': ['<%= src.js %>', '<%= src.jsTpl %>'] }
      },
      vendor: {
        options: { preserveComments: 'some' }, // Preserve license comments
        files: { '<%= distdir %>/js/vendor.js': ['<%= src.jsVendor %>'],
                 '<%= distdir %>/js/angular.js': ['<%= src.angularVendor %>']
        }
      }
    },
    postcss: {
      build: {
        options: {
          processors: [
            autoprefixer({browsers: 'last 2 versions'}), // add vendor prefixes
            cssnano() // minify the result
          ]
        },
        src: '<%= distdir %>/css/<%= pkg.name %>.css',
        dest: '<%= distdir %>/css/app.css'
      }
    },
    watch: {
      build: {
        files: ['<%= src.js %>', '<%= src.css %>', '<%= src.tpl %>', '<%= src.html %>'],
        tasks: ['build']
      }
    },
    shell: {
      buildBinary: {
        command: function (p, a) {
          var binfile = 'dist/portainer-'+p+'-'+a;
          if (grunt.file.isFile( ( p === 'windows' ) ? binfile+'.exe' : binfile )) {
            return 'echo "Portainer binary exists"';
          } else {
            return 'build/build_in_container.sh ' + p + ' ' + a;
          }
        }
      },
      rm: { command: 'if [ -z "$(docker container inspect portainer 2>&1 | grep "Error:")" ]; then docker container rm -f portainer; fi' },
      run: { command: 'docker run -d -p 9000:9000 -v $(pwd)/dist:/app -v /tmp/portainer:/data -v /var/run/docker.sock:/var/run/docker.sock:z --name portainer portainer/base /app/portainer-linux-' + arch + ' --no-analytics' },
      downloadDockerBinary: {
        command: function(p, a) {
          var ext = ((p === 'windows') ? '.zip' : '.tgz');
          var tarname = 'docker-<%= shippedDockerVersion %>';

          var ps = { 'windows': 'win', 'darwin': 'mac' };
          var as = { 'amd64': 'x86_64', 'arm': 'armhf', 'arm64': 'aarch64' };
          var ip = ((ps[p] === undefined) ? p : ps[p]);
          var ia = ((as[a] === undefined) ? a : as[a]);

          return [
            'mkdir -pv <%= dockerdir %>',
            'wget "https://download.docker.com/' + ip + '/static/stable/' + ia + '/' + tarname + ext + '"',
            'mv ' + tarname + ext + ' <%= dockerdir %>' + tarname + '-' + p + '-' + a + ext
          ].join(';');
        }
      },
      extractDockerBinary: {
        command: function(p, a) {
          var tarname = 'docker-<%= shippedDockerVersion %>-' + p + '-' + a + ((p === 'windows') ? '.zip' : '.tgz');

          return [
            'rm -rf .tmp/docker-extract',
            'mkdir -pv .tmp/docker-extract',
            ((p === 'windows') ?
              'unzip <%= dockerdir %>' + tarname + ' -d ".tmp/docker-extract"' :
              'tar -xf <%= dockerdir %>' + tarname + ' -C ".tmp/docker-extract"'
            ),
            'mv .tmp/docker-extract/docker/docker' + ((p === 'windows') ? '.exe' : '') + ' <%= distdir %>/../'
          ].join(';');
        }
      }
    },
    replace: {
      concat: {
        options: {
          patterns: [
            {
              match: 'ENVIRONMENT',
              replacement: '<%= grunt.config.get("environment") %>'
            },
            {
              match: 'CONFIG_GA_ID',
              replacement: '<%= pkg.config.GA_ID %>'
            }
          ]
        },
        files: [
          {
            expand: true,
            flatten: true,
            src: ['.tmp/concat/js/app.js'],
            dest: '.tmp/concat/js'
          }
        ]
      }
    }
  });

  grunt.registerTask('vendor', 'vendor:<min|reg>', function(min) {
    // The content of `vendor.yml` is loaded to src.jsVendor, src.cssVendor and src.angularVendor
    // Argument `min` selects between the 'regular' or 'minified' sets
    var m = ( min === '' ) ? 'minified' : min;
    var v = grunt.file.readYAML('vendor.yml');
    for (type in v) { if (v.hasOwnProperty(type)) {
      grunt.config('src.'+type+'Vendor',v[type][m]);
    }}
  });
};
